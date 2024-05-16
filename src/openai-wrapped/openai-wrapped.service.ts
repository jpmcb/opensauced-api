/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { z, ZodSchema } from "zod";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import { ChatCompletionRunner } from "openai/lib/ChatCompletionRunner";
import { ChatCompletionStreamingRunner } from "openai/lib/ChatCompletionStreamingRunner";
import { RunnableToolFunctionWithParse } from "openai/lib/RunnableFunction";
import { JSONSchema } from "openai/lib/jsonschema";
import { zodToJsonSchema } from "zod-to-json-schema";
import { AsyncOrSyncFunction } from "./types/tools.types";

@Injectable()
export class OpenAIWrappedService {
  // a persistent client for this class to access the OpenAI services
  openaiClient: OpenAI;

  // the configurations for generating vector embeddings.
  embeddingModel: string;
  embeddingDimensions: number;

  /*
   * the configured models to use when performing various tasks.
   *
   * for the completions model, where summaries of PRs and Issues are being
   * generated in Highlights, gpt-3.5-turbo or any of the newer flagship models will suffice.
   *
   * for the tools model, the LLM that does the "function calling" primarily used by StarSearch, you'll need
   * one of the newer flagship models that is trained on function calling capabilities
   * and can handle advanced reasoning. gpt-4-turbo is probably preferred. Although
   * gpt-4o is much faster and may return similar results. Dealers choice.
   *
   * the decider model also needs to be able to accurately reason about and be able to make decisions about
   * what tools to pick from a list of tools. But, it doesn't need to handle more verbose
   * text generation for end user answers. One of the more advanced "lazy" models, like gpt-4o,
   * is likely a safe bet.
   *
   */
  completionsModel: string;
  toolsModel: string;
  deciderModel: string;

  constructor(private configService: ConfigService) {
    const openAIKey: string = this.configService.get("openai.APIKey")!;

    this.openaiClient = new OpenAI({
      apiKey: openAIKey,
    });

    this.embeddingModel = this.configService.get("openai.embeddingsModelName")!;
    this.embeddingDimensions = parseInt(this.configService.get("openai.embeddingsModelDimensions")!);

    this.completionsModel = this.configService.get("openai.completionsModelName")!;
    this.toolsModel = this.configService.get("openai.toolsModelName")!;
    this.deciderModel = this.configService.get("openai.deciderModelName")!;
  }

  async generateCompletion(systemMessage: string, userMessage: string, temperature: number): Promise<string> {
    const params: OpenAI.Chat.ChatCompletionCreateParams = {
      messages: [
        {
          role: "system",
          content: systemMessage,
        },
        {
          role: "user",
          content: userMessage,
        },
      ],
      temperature: temperature / 10,
      n: 1,
      model: this.completionsModel,
    };

    const response: OpenAI.Chat.ChatCompletion = await this.openaiClient.chat.completions.create(params).catch((e) => {
      if (e instanceof Error) {
        throw new Error(`Error from openAI: ${e.message}`);
      }

      throw new Error("unhandled error from OpenAI");
    });

    if (!response.choices[0]) {
      throw new Error("Could not complete openAI API request - no response choices returned");
    }

    if (!response.choices[0].message.content) {
      throw new Error("OpenAI returned a null response in the message content");
    }

    return response.choices[0].message.content;
  }

  /*
   * a generic utility function that returns a RunnableToolFunctionWithParse.
   * these you can pass to the OpenAI client `.runTools()`,
   * with a fully validated, typesafe parameters schema provided by Zod.
   *
   * Provided by OpenAI via: https://github.com/openai/openai-node/blob/master/examples/tool-call-helpers-zod.ts
   */

  makeRunnableToolFunction<T extends object, R>({
    function: fn,
    schema,
    description = "",
    name,
  }: {
    function: AsyncOrSyncFunction<T, R>;
    schema: ZodSchema<T>;
    description?: string;
    name?: string;
  }): RunnableToolFunctionWithParse<T> {
    return {
      type: "function",
      function: {
        function: fn,
        name: name ?? fn.name,
        description,
        parameters: zodToJsonSchema(schema) as JSONSchema,
        parse(input: string): T {
          /*
           * provides a "parse" function to the runnable tool that will parse the
           * json and then use the zod schema to validate it. This allows the LLM
           * to generate string JSON params but also loop back and try again if it
           * generates junk json.
           *
           * Highly recommended to follow this pattern from OpenAI.
           */

          return schema.parse(JSON.parse(input));
        },
      },
    };
  }

  /*
   * uses the "runTools" OpenAI convinence helper to enter a function calling loop.
   * The LLM will continue to call functions as long as it makes tool choices.
   *
   * Returns content results as a stream.
   */

  runToolsStream(
    systemMessage: string,
    userMessage: string,
    tools: RunnableToolFunctionWithParse<any>[]
  ): ChatCompletionStreamingRunner {
    return this.openaiClient.beta.chat.completions.runTools({
      model: this.toolsModel,
      stream: true,
      tools,
      tool_choice: "auto",
      messages: [
        {
          role: "system",
          content: systemMessage,
        },
        {
          role: "user",
          content: userMessage,
        },
      ],
    });
  }

  /*
   * uses the "runTools" OpenAI convinence helper to enter a function calling loop.
   * The LLM will continue to call functions as long as it makes tool choices.
   *
   * Returns content results as a single chunk and is not async.
   * There are both "runTools" and "runToolsStream" because the types in the "stream"
   * parameter to "runTools" don't seem to be able to take a "boolean" type.
   */

  runTools(
    systemMessage: string,
    userMessage: string,
    tools: RunnableToolFunctionWithParse<any>[]
  ): ChatCompletionRunner {
    return this.openaiClient.beta.chat.completions.runTools({
      model: this.toolsModel,
      stream: false,
      tools,
      tool_choice: "auto",
      messages: [
        {
          role: "system",
          content: systemMessage,
        },
        {
          role: "user",
          content: userMessage,
        },
      ],
    });
  }

  /*
   * this is a small utility AI agent that can be used with an array of "RunnableToolFunctionWithParse"
   * tools, the system prompt of another AI agent, and the input prompt to that other agent.
   * This agent's aim is to determine if one of the provided "short circuit" tools can be used directly
   * instead of entering that agents run-tools loop (which may potentially be more time-consuming).
   *
   * if this agent determines that one of the short circuit tools is the right choice, it will return the tool name
   * and the validated parameters for that tool.
   *
   * Why is this useful?
   *
   * An AI agent's run-tools loop can be expensive and time consuming since an agent will need
   * to evaluate the prompt, call functions, get the results, and generate a response.
   * In some cases, it may actually be more advantageous to just return the raw results of a function
   * directly to the calling AI agent to then generate a response.
   *
   * This effectively provides an agent a "short circuit" that can simply return the results
   * for one of its tools directly.
   */

  async decideShortCircuitTool(
    systemMessageToEvaluate: string,
    promptToEvaluate: string,
    scTools: RunnableToolFunctionWithParse<object>[]
  ): Promise<{ name: string; validatedParams: any } | null> {
    const scToolNames = scTools.map((tool) => tool.function.name);
    const scToolSchemas = scTools.map((tool) => JSON.stringify(tool.function.parameters));

    const systemMessage = `You are a "Tool Short Circuit AI agent". Your goal is to evaluate other AI agent systems and determine if any one provided tool based on the system and user prompt can return immediate results, bypassing the usual processing loop. A short-circuit is optimal when you can determine with an extremely high level of confidence that the raw results from a single tool will satisfy the provided prompt.

You will also be provided with the schemas for the available short circuit tools. Provide your results as a valid JSON object where "name" is the name of the tool and "params" is the tool's valid schema like so:

{
  "name": <short-circuit-tool-name>,
  "params": {
    <short-circuit-tool-json-schema>
  }
}

Your results should contain ONLY JSON. Do not include \`\`\` backticks or denote that it is JSON. Do not provide any further explanation, only JSON.

If no optimal tool can be selected or the query is too vague to reach a confident decision, simply return nothing.

If multiple short-circuit tools can be used and no single tool is the obvious outstanding choice, simply return nothing.

Only select tools from the provide short-circuit list. If one of the tools from the system message that is NOT part of the short-circuit tools is better, simply return nothing.

Additional Guidelines:
- Validate the parameters against the provided schemas to ensure correctness.
- Do not make assumptions about parameter names or values if the information is ambiguous or incorrect.
- If the provided information does not match any available tool's schema accurately, return nothing.

End to end example:

You receive a system message that instructs a 'User Content AI agent' on how to use its various tools to aggregate and summarize user content. It includes descriptions of both "summarizeUserContent" and "getUserContent".

In the system message, "summarizeUserContent" is described as a tool that aggregates the specified user's content and generates a summary. The "getUserContent" tool returns the user's content without summarizing or generating anything.

The list of 'short-circuit tools' includes "getUserContent" but not "summarizeUserContent". You are also provided with the schema for "getUserContent" which expects a JSON object of { username: <specified-user> }

- If the query is "Summarize all the content for user jpmcb", return nothing since the 'User Content AI agent' should enter it's function calling loop to execute the "summarizeUserContent" tool.

- If the query is "Get all content for brandonroberts", select the "getUserContent" tool and return the JSON object with the name and parameters based on the schema:

{
  "name": "getUserContent",
  "params": {
    "username": "brandonroberts"
  }
}`;

    const prompt = `System message to evaluate:
${systemMessageToEvaluate}

Prompt:
${promptToEvaluate}

Available short-circuit tools:
${scToolNames.join(", ")}

Tool schemas:
${scToolSchemas.join("\n")}`;

    try {
      const response = await this.openaiClient.chat.completions.create({
        model: this.deciderModel,
        temperature: 0.5,
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: prompt },
        ],
        max_tokens: 256,
      });

      const choiceText = response.choices[0].message.content!.trim();

      if (!choiceText) {
        return null;
      }

      /*
       * use Zod for safe JSON parsing and validation of incoming schema
       * throws if there is a validation error.
       */
      const choiceJson = z
        .object({
          name: z.string(),
          params: z.record(z.unknown()),
        })
        .parse(JSON.parse(choiceText));

      /*
       * verify the selected tool is part of the short-circuit tools.
       * if not, this means the decider agent wanted to use a tool not in the short-circuit array.
       * return null so that the other agent can enter its run-tools loop.
       */
      if (!scToolNames.includes(choiceJson.name)) {
        return null;
      }

      const selectedTool = scTools.find((tool) => tool.function.name === choiceJson.name);
      const validationResult = await selectedTool!.function.parse(JSON.stringify(choiceJson.params));

      return { name: choiceJson.name, validatedParams: validationResult };
    } catch (error) {
      console.error("short-circuit error deciding function:", error);
      return null;
    }
  }

  /*
   * creates a text embedding for an input text using the configured embedding model
   */

  async generateEmbedding(input: string): Promise<number[]> {
    const params: OpenAI.Embeddings.EmbeddingCreateParams = {
      model: this.embeddingModel,
      dimensions: this.embeddingDimensions,
      input,
    };

    const response: OpenAI.Embeddings.CreateEmbeddingResponse = await this.openaiClient.embeddings
      .create(params)
      .catch((e) => {
        if (e instanceof Error) {
          throw new Error(`Could not complete openAI API request: ${e.message}`);
        }

        throw new Error("unhandled error from OpenAI");
      });

    if (response.data.length === 0) {
      throw new Error("Data embeddings from OpenAI empty");
    }

    return response.data[0].embedding;
  }
}
