import { Injectable } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { AxiosResponse } from "@nestjs/terminus/dist/health-indicator/http/axios.interfaces";
import { BingSearchResultDto } from "../dtos/bing-search-results.dto";
import { BingSearchResponse, BingWebPageResult } from "../interfaces/bing-search-result.interface";
import { ToolFunction } from "../types/toolfunction.type";
import { BingSearchAgentParams, SearchBingParams } from "../schemas/bing.schema";
import { OpenAIWrappedService } from "../../openai-wrapped/openai-wrapped.service";

@Injectable()
export class BingSearchAgent {
  agentSystemMessage: string;

  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
    private openAIWrappedService: OpenAIWrappedService
  ) {
    this.agentSystemMessage = this.configService.get("starsearch.bingAgentSystemMessage")!;
  }

  async bingSearch({ query }: SearchBingParams): Promise<BingSearchResultDto[]> {
    const subscriptionApiKey: string = this.configService.get("bing.subscriptionApiKey")!;
    const endpoint: string = this.configService.get("bing.endpoint")!;

    try {
      const response: AxiosResponse<BingSearchResponse> | undefined = await this.httpService
        .get(endpoint, {
          params: {
            /*
             * the params to Bing search include:
             *
             * q - the query to send to bing.
             * textDecorations - adds metadata to the search results (such as bolding)
             * textFormat - the return format of the resulting text which an LLM can parse
             * count - The number of results to return
             */

            q: query,
            textDecorations: "True",
            textFormat: "HTML",
            count: 10,
          },
          headers: { "Ocp-Apim-Subscription-Key": subscriptionApiKey },
        })
        .toPromise();

      return this.parseBingSearchResults(response!.data);
    } catch (error: unknown) {
      if (error instanceof Error) {
        /*
         * simply bail out and return nothing (so that the LLM tools loop can continue
         * and possibly recover).
         */
        console.log(error);
        return [];
      }

      return [];
    }
  }

  private parseBingSearchResults(searchResults: BingSearchResponse): BingSearchResultDto[] {
    const cleanResults: BingSearchResultDto[] = [];

    searchResults.webPages.value.forEach((result: BingWebPageResult) => {
      const details: BingSearchResultDto = {
        title: result.name,
        url: result.url,
        displayUrl: result.displayUrl ?? result.url,
        snippet: result.snippet,
        datePublished: result.datePublished ?? "date not available",
      };

      cleanResults.push(details);
    });

    return cleanResults;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private shortCircuitToolsMap = new Map<string, ToolFunction<any>>([
    ["bingSearch", this.bingSearch.bind(this)],

    /*
     * todo - plan to also implement a tool that can be called to get spelling corrections,
     * the right repo name, etc.
     */
  ]);

  async runAgentTools(agentParams: BingSearchAgentParams): Promise<string | null | unknown> {
    const tools = [
      this.openAIWrappedService.makeRunnableToolFunction({
        function: async (params: SearchBingParams) => this.bingSearch(params),
        schema: SearchBingParams,
        name: "bingSearch",
        description: "Searches the internet using an input query.",
      }),
    ];

    // directly call the function if the agent can decide based on the prompt
    const shortCircuitDecision = await this.openAIWrappedService.decideShortCircuitTool(
      this.agentSystemMessage,
      agentParams.prompt,
      tools
    );

    if (shortCircuitDecision?.name) {
      const selectedTool = this.shortCircuitToolsMap.get(shortCircuitDecision.name);

      if (selectedTool) {
        console.log("bing agent short-circuit selected", selectedTool);
        return selectedTool(shortCircuitDecision.validatedParams);
      }
    }

    const runner = this.openAIWrappedService
      .runTools(this.agentSystemMessage, agentParams.prompt, tools)
      .on("message", (msg) => console.log("bing agent msg", msg))
      .on("functionCall", (functionCall) => console.log("bing agent functionCall", functionCall))
      .on("functionCallResult", (functionCallResult) =>
        console.log("bing agent functionCallResult", functionCallResult)
      );

    return runner.finalContent();
  }
}
