import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { z } from "zod";
import { OpenAIWrappedService } from "../../openai-wrapped/openai-wrapped.service";
import {
  PreProcessorAgentParams,
  PreProcessorError,
  PreProcessorProcessedPrompt,
} from "../schemas/pre-processor.schema";
import { SearchBingParams } from "../schemas/bing.schema";
import { BingSearchAgent } from "./bing-search.agent";

@Injectable()
export class PreProcessorAgent {
  agentSystemMessage: string;

  constructor(
    private bingSearchAgent: BingSearchAgent,
    private configService: ConfigService,
    private openAIWrappedService: OpenAIWrappedService
  ) {
    this.agentSystemMessage = this.configService.get("starsearch.preProcessorAgentSystemMessage")!;
  }

  async preProcessPrompt(
    agentParams: PreProcessorAgentParams
  ): Promise<PreProcessorProcessedPrompt | PreProcessorError | null> {
    const tools = [
      this.openAIWrappedService.makeRunnableToolFunction({
        function: async (params: SearchBingParams) => this.bingSearchAgent.bingSearch(params),
        schema: SearchBingParams,
        name: "inferGitHubRepoName",
        description:
          "Searches the internet using an input query to find the correct name of a GitHub repository. A good strategy is to prepend search queries with 'GitHub' to find the correct repository name.",
      }),

      this.openAIWrappedService.makeRunnableToolFunction({
        function: async (params: SearchBingParams) => this.bingSearchAgent.bingSearch(params),
        schema: SearchBingParams,
        name: "inferGitHubUsername",
        description:
          "Searches the internet using an input query to find the correct GitHub username of a given input. A good strategy is to prepend search queries with 'GitHub' to find the correct username.",
      }),
    ];

    let prompt;

    if (agentParams.lastMessage && agentParams.threadSummary) {
      prompt = `Chat history summary:
---
${agentParams.threadSummary}

Last message:
---
${agentParams.lastMessage}`;
    } else {
      prompt = `Chat history summary:
---
No chat history present.

Last message:
---
No chat history present.`;
    }

    prompt += `

Evaluate the following user prompt given the chat history and summary:
---
\`\`\`
${agentParams.prompt}
\`\`\``;

    const runner = this.openAIWrappedService
      .runTools(this.agentSystemMessage, prompt, tools)
      .on("message", (msg) => console.log("pre-processor agent msg", msg))
      .on("functionCall", (functionCall) => console.log("pre-processor agent functionCall", functionCall))
      .on("functionCallResult", (functionCallResult) =>
        console.log("pre-processor agent functionCallResult", functionCallResult)
      );

    const finalContent = await runner.finalContent();

    if (!finalContent) {
      console.error("pre-processor agent returned no content");
      return null;
    }

    try {
      return z.union([PreProcessorProcessedPrompt, PreProcessorError]).parse(JSON.parse(finalContent));
    } catch (error) {
      console.error("pre-processor agent errored", error);
      return null;
    }
  }
}
