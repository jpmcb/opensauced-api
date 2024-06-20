import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OpenAIWrappedService } from "../../openai-wrapped/openai-wrapped.service";
import { ToolFunction } from "../types/toolfunction.type";
import {
  IssuesAgentParams,
  SearchAllIssuesInDatasetParams,
  SearchAllIssuesParams,
  SearchIssuesByAuthorInDatasetParams,
  SearchIssuesByAuthorParams,
  SearchIssuesByRepoNameAndAuthorParams,
  SearchIssuesByRepoNameParams,
} from "../schemas/issues.schema";
import { IssuesGithubEventsVectorService } from "../../timescale/issues_github-events_vector.service";

@Injectable()
export class IssuesAgent {
  agentSystemMessage: string;

  constructor(
    private configService: ConfigService,
    private openAIWrappedService: OpenAIWrappedService,
    private issuesGithubEventsVectorService: IssuesGithubEventsVectorService
  ) {
    this.agentSystemMessage = this.configService.get("starsearch.issuesAgentSystemMessage")!;
  }

  async searchAllIssues({ question }: SearchAllIssuesParams) {
    const queryEmbedding = await this.openAIWrappedService.generateEmbedding(question);

    return this.issuesGithubEventsVectorService.cosineSimilarity({
      embedding: queryEmbedding,
      range: 30,
      prevDaysStartDate: 0,
    });
  }

  async searchAllIssuesInDataset({ question, dataset }: SearchAllIssuesInDatasetParams) {
    const queryEmbedding = await this.openAIWrappedService.generateEmbedding(question);

    return this.issuesGithubEventsVectorService.cosineSimilarity({
      embedding: queryEmbedding,
      range: 30,
      prevDaysStartDate: 0,
      repoNames: dataset,
    });
  }

  async searchIssuesByRepoName({ question, repoName }: SearchIssuesByRepoNameParams) {
    const queryEmbedding = await this.openAIWrappedService.generateEmbedding(question);

    return this.issuesGithubEventsVectorService.cosineSimilarity({
      embedding: queryEmbedding,
      range: 30,
      prevDaysStartDate: 0,
      repoNames: [repoName],
    });
  }

  async searchIssuesByAuthor({ question, author }: SearchIssuesByAuthorParams) {
    const queryEmbedding = await this.openAIWrappedService.generateEmbedding(question);

    return this.issuesGithubEventsVectorService.cosineSimilarity({
      embedding: queryEmbedding,
      range: 30,
      prevDaysStartDate: 0,
      author,
    });
  }

  async searchIssuesByRepoNameAndAuthor({ question, repoName, author }: SearchIssuesByRepoNameAndAuthorParams) {
    const queryEmbedding = await this.openAIWrappedService.generateEmbedding(question);

    return this.issuesGithubEventsVectorService.cosineSimilarity({
      embedding: queryEmbedding,
      range: 30,
      prevDaysStartDate: 0,
      repoNames: [repoName],
      author,
    });
  }

  async searchIssuesByAuthorInDataset({ question, author, dataset }: SearchIssuesByAuthorInDatasetParams) {
    const queryEmbedding = await this.openAIWrappedService.generateEmbedding(question);

    return this.issuesGithubEventsVectorService.cosineSimilarity({
      embedding: queryEmbedding,
      range: 30,
      prevDaysStartDate: 0,
      repoNames: dataset,
      author,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private shortCircuitToolsMap = new Map<string, ToolFunction<any>>([
    ["searchAllIssues", this.searchAllIssues.bind(this)],
    ["searchAllIssuesInDataset", this.searchAllIssuesInDataset.bind(this)],
    ["searchIssuesByRepoName", this.searchIssuesByRepoName.bind(this)],
    ["searchIssuesByAuthor", this.searchIssuesByAuthor.bind(this)],
    ["searchIssuesByRepoNameAndAuthor", this.searchIssuesByRepoNameAndAuthor.bind(this)],
    ["searchIssuesByAuthorInDataset", this.searchIssuesByAuthorInDataset.bind(this)],
  ]);

  async runAgentTools(agentParams: IssuesAgentParams): Promise<string | null | unknown> {
    const tools = [
      this.openAIWrappedService.makeRunnableToolFunction({
        function: async (params: SearchAllIssuesParams) => this.searchAllIssues(params),
        schema: SearchAllIssuesParams,
        name: "searchAllIssues",
        description:
          "Searches all GitHub issues and their context. Returns relevant summaries of issues based on the input user question.",
      }),

      this.openAIWrappedService.makeRunnableToolFunction({
        function: async (params: SearchAllIssuesInDatasetParams) => this.searchAllIssuesInDataset(params),
        schema: SearchAllIssuesInDatasetParams,
        name: "searchAllIssuesInDataset",
        description:
          "Searches all GitHub issues and their context within a given dataset. Returns relevant summaries of issues based on the input user question. Repo names within the dataset be of the form: 'organization/name'. Example: facebook/react. A dataset is an array made up of several repo names. Example ['facebook/react','microsoft/vscode'].",
      }),

      this.openAIWrappedService.makeRunnableToolFunction({
        function: async (params: SearchIssuesByRepoNameParams) => this.searchIssuesByRepoName(params),
        schema: SearchIssuesByRepoNameParams,
        name: "searchIssuesByRepoName",
        description:
          "Searches GitHub issues and their context for a specific repository. Returns relevant summaries of issues based on the input user question. The repoName parameter should be of the form: 'organization/name'. Example: facebook/react.",
      }),

      this.openAIWrappedService.makeRunnableToolFunction({
        function: async (params: SearchIssuesByAuthorParams) => this.searchIssuesByAuthor(params),
        schema: SearchIssuesByAuthorParams,
        name: "searchIssuesByAuthor",
        description:
          "Searches GitHub issues and their context by a specific issue author. Returns relevant summaries of issues based on the input user question. The 'author' parameter is the GitHub login of a specific user.",
      }),

      this.openAIWrappedService.makeRunnableToolFunction({
        function: async (params: SearchIssuesByRepoNameAndAuthorParams) => this.searchIssuesByRepoNameAndAuthor(params),
        schema: SearchIssuesByRepoNameAndAuthorParams,
        name: "searchIssuesByRepoNameAndAuthor",
        description:
          "Searches GitHub issues and their context in a specific repository and by a specific issue author. Returns relevant summaries of issues based on the input user question. The repoName parameter should be of the form: 'organization/name'. Example: facebook/react. The 'author' parameter is the GitHub login of a specific user.",
      }),

      this.openAIWrappedService.makeRunnableToolFunction({
        function: async (params: SearchIssuesByAuthorInDatasetParams) => this.searchIssuesByAuthorInDataset(params),
        schema: SearchIssuesByAuthorInDatasetParams,
        name: "searchIssuesByAuthorInDataset",
        description:
          "Searches GitHub issues and their context by a specific issue author within the given dataset. Returns relevant summaries of issues based on the input user question. Repo names within the dataset be of the form: 'organization/name'. Example: facebook/react. A dataset is an array made up of several repo names. Example ['facebook/react','microsoft/vscode']. The 'author' parameter is the GitHub login of a specific user.",
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
        console.log("issues agent short circuit selected", selectedTool);
        return selectedTool(shortCircuitDecision.validatedParams);
      }
    }

    const runner = this.openAIWrappedService
      .runTools(this.agentSystemMessage, agentParams.prompt, tools)
      .on("message", (msg) => console.log("issues agent msg", msg))
      .on("functionCall", (functionCall) => console.log("issues agent functionCall", functionCall))
      .on("functionCallResult", (functionCallResult) =>
        console.log("issues agent functionCallResult", functionCallResult)
      );

    return runner.finalContent();
  }
}
