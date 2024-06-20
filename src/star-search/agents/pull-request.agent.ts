import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OpenAIWrappedService } from "../../openai-wrapped/openai-wrapped.service";
import { PullRequestGithubEventsVectorService } from "../../timescale/pull_request_github-events_vector.service";
import {
  PullRequestAgentParams,
  SearchAllPrsInDatasetParams,
  SearchAllPrsParams,
  SearchPrsByAuthorInDatasetParams,
  SearchPrsByAuthorParams,
  SearchPrsByRepoNameAndAuthorParams,
  SearchPrsByRepoNameParams,
} from "../schemas/pull-requests.schema";
import { ToolFunction } from "../types/toolfunction.type";

@Injectable()
export class PullRequestAgent {
  agentSystemMessage: string;

  constructor(
    private configService: ConfigService,
    private openAIWrappedService: OpenAIWrappedService,
    private pullRequestGithubEventsVectorService: PullRequestGithubEventsVectorService
  ) {
    this.agentSystemMessage = this.configService.get("starsearch.pullRequestAgentSystemMessage")!;
  }

  private async searchAllPrs({ question }: SearchAllPrsParams) {
    const queryEmbedding = await this.openAIWrappedService.generateEmbedding(question);

    return this.pullRequestGithubEventsVectorService.cosineSimilarity({
      embedding: queryEmbedding,
      range: 30,
      prevDaysStartDate: 0,
    });
  }

  private async searchAllPrsInDataset({ question, dataset }: SearchAllPrsInDatasetParams) {
    const queryEmbedding = await this.openAIWrappedService.generateEmbedding(question);

    return this.pullRequestGithubEventsVectorService.cosineSimilarity({
      embedding: queryEmbedding,
      range: 30,
      prevDaysStartDate: 0,
      repoNames: dataset,
    });
  }

  private async searchPrsByRepoName({ question, repoName, range }: SearchPrsByRepoNameParams) {
    const queryEmbedding = await this.openAIWrappedService.generateEmbedding(question);

    return this.pullRequestGithubEventsVectorService.cosineSimilarity({
      embedding: queryEmbedding,
      range,
      prevDaysStartDate: 0,
      repoNames: [repoName],
    });
  }

  private async searchPrsByAuthor({ question, author }: SearchPrsByAuthorParams) {
    const queryEmbedding = await this.openAIWrappedService.generateEmbedding(question);

    return this.pullRequestGithubEventsVectorService.cosineSimilarity({
      embedding: queryEmbedding,
      range: 30,
      prevDaysStartDate: 0,
      author,
    });
  }

  private async searchPrsByRepoNameAndAuthor({ question, repoName, author }: SearchPrsByRepoNameAndAuthorParams) {
    const queryEmbedding = await this.openAIWrappedService.generateEmbedding(question);

    return this.pullRequestGithubEventsVectorService.cosineSimilarity({
      embedding: queryEmbedding,
      range: 30,
      prevDaysStartDate: 0,
      repoNames: [repoName],
      author,
    });
  }

  private async searchPrsByAuthorInDataset({ question, author, dataset }: SearchPrsByAuthorInDatasetParams) {
    const queryEmbedding = await this.openAIWrappedService.generateEmbedding(question);

    return this.pullRequestGithubEventsVectorService.cosineSimilarity({
      embedding: queryEmbedding,
      range: 30,
      prevDaysStartDate: 0,
      repoNames: dataset,
      author,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private shortCircuitToolsMap = new Map<string, ToolFunction<any>>([
    ["searchAllPrs", this.searchAllPrs.bind(this)],
    ["searchAllPrsInDataset", this.searchAllPrsInDataset.bind(this)],
    ["searchPrsByRepoName", this.searchPrsByRepoName.bind(this)],
    ["searchPrsByAuthor", this.searchPrsByAuthor.bind(this)],
    ["searchPrsByRepoNameAndAuthor", this.searchPrsByRepoNameAndAuthor.bind(this)],
    ["SearchPrsByAuthorInDataset", this.searchPrsByAuthorInDataset.bind(this)],
  ]);

  async runTools(agentParams: PullRequestAgentParams): Promise<string | null | unknown> {
    const tools = [
      /*
       * ---------------
       * PRs tools
       */

      this.openAIWrappedService.makeRunnableToolFunction({
        function: async (params: SearchAllPrsParams) => this.searchAllPrs(params),
        schema: SearchAllPrsParams,
        name: "searchAllPrs",
        description:
          "Searches all GitHub pull requests and their context. Returns relevant summaries of pull requests based on the input user question.",
      }),

      this.openAIWrappedService.makeRunnableToolFunction({
        function: async (params: SearchAllPrsInDatasetParams) => this.searchAllPrs(params),
        schema: SearchAllPrsInDatasetParams,
        name: "searchAllPrsInDataset",
        description:
          "Searches all GitHub pull requests and their context within a given dataset. Returns relevant summaries of pull requests based on the input user question. Repo names within the dataset be of the form: 'organization/name'. Example: facebook/react. A dataset is an array made up of several repo names. Example ['facebook/react','microsoft/vscode'].",
      }),

      this.openAIWrappedService.makeRunnableToolFunction({
        function: async (params: SearchPrsByRepoNameParams) => this.searchPrsByRepoName(params),
        schema: SearchPrsByRepoNameParams,
        name: "searchPrsByRepoName",
        description:
          "Searches GitHub pull requests and their content in a specific repository. Returns relevant summaries of pull requests based on the input user question over a range of days. The repoName parameter should be of the form: 'organization/name'. Example: facebook/react.",
      }),

      this.openAIWrappedService.makeRunnableToolFunction({
        function: async (params: SearchPrsByAuthorParams) => this.searchPrsByAuthor(params),
        schema: SearchPrsByAuthorParams,
        name: "searchPrsByAuthor",
        description:
          "Searches GitHub pull requests and their context by a specific PR author. Returns relevant summaries of pull requests based on the input user question. The 'author' parameter is the GitHub login of a specific user.",
      }),

      this.openAIWrappedService.makeRunnableToolFunction({
        function: async (params: SearchPrsByRepoNameAndAuthorParams) => this.searchPrsByRepoNameAndAuthor(params),
        schema: SearchPrsByRepoNameAndAuthorParams,
        name: "searchPrsByRepoNameAndAuthor",
        description:
          "Searches GitHub pull requests and their context in a specific repository and by a specific PR author. Returns relevant summaries of pull requests based on the input user question. The repoName parameter should be of the form: 'organization/name'. Example: facebook/react. The 'author' parameter is the GitHub login of a specific user.",
      }),

      this.openAIWrappedService.makeRunnableToolFunction({
        function: async (params: SearchPrsByAuthorInDatasetParams) => this.searchPrsByAuthorInDataset(params),
        schema: SearchPrsByAuthorInDatasetParams,
        name: "searchPrsByAuthorIndataset",
        description:
          "Searches GitHub pull requests and their context by a specific PR author within a given dataset. Returns relevant summaries of pull requests based on the input user question. Repo names within the dataset be of the form: 'organization/name'. Example: facebook/react. A dataset is an array made up of several repo names. Example ['facebook/react','microsoft/vscode']. The 'author' parameter is the GitHub login of a specific user.",
      }),
    ];

    // directly call the function if the agent can decide based on the prompt
    const shortCircuitDecision = await this.openAIWrappedService.decideShortCircuitTool(
      this.agentSystemMessage,
      JSON.stringify(agentParams),
      tools
    );

    if (shortCircuitDecision?.name) {
      const selectedTool = this.shortCircuitToolsMap.get(shortCircuitDecision.name);

      if (selectedTool) {
        console.log("pull request agent short-circuit selected", selectedTool);
        return selectedTool(shortCircuitDecision.validatedParams);
      }
    }

    const runner = this.openAIWrappedService
      .runTools(this.agentSystemMessage, agentParams.prompt, tools)
      .on("message", (msg) => console.log("pull req agent msg", msg))
      .on("functionCall", (functionCall) => console.log("pull req agent functionCall", functionCall))
      .on("functionCallResult", (functionCallResult) =>
        console.log("pull req agent functionCallResult", functionCallResult)
      );

    return runner.finalContent();
  }
}
