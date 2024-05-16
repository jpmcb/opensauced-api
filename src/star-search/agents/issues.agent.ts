import { Injectable } from "@nestjs/common";
import { OpenAIWrappedService } from "../../openai-wrapped/openai-wrapped.service";
import { ToolFunction } from "../types/toolfunction.type";
import {
  IssuesAgentParams,
  SearchAllIssuesParams,
  SearchIssuesByAuthorParams,
  SearchIssuesByRepoNameAndAuthorParams,
  SearchIssuesByRepoNameParams,
} from "../schemas/issues.schema";
import { IssuesGithubEventsVectorService } from "../../timescale/issues_github-events_vector.service";

@Injectable()
export class IssuesAgent {
  constructor(
    private openAIWrappedService: OpenAIWrappedService,
    private issuesGithubEventsVectorService: IssuesGithubEventsVectorService
  ) {}

  async searchAllIssues({ question }: SearchAllIssuesParams) {
    const queryEmbedding = await this.openAIWrappedService.generateEmbedding(question);

    return this.issuesGithubEventsVectorService.cosineSimilarity({
      embedding: queryEmbedding,
      range: 30,
      prevDaysStartDate: 0,
    });
  }

  async searchIssuesByRepoName({ question, repoName }: SearchIssuesByRepoNameParams) {
    const queryEmbedding = await this.openAIWrappedService.generateEmbedding(question);

    return this.issuesGithubEventsVectorService.cosineSimilarity({
      embedding: queryEmbedding,
      range: 30,
      prevDaysStartDate: 0,
      repoName,
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
      repoName,
      author,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private shortCircuitToolsMap = new Map<string, ToolFunction<any>>([
    ["searchAllIssues", this.searchAllIssues.bind(this)],
    ["searchIssuesByRepoName", this.searchIssuesByRepoName.bind(this)],
    ["searchIssuesByAuthor", this.searchIssuesByAuthor.bind(this)],
    ["searchIssuesByRepoNameAndAuthor", this.searchIssuesByRepoNameAndAuthor.bind(this)],
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
    ];

    const systemMessage = `You are the OpenSauced "Issues AI Agent". Your purpose is to interact with other AI agent callers that are querying you for information and insights into GitHub issues.

In your toolkit, you have multiple functions designed to retrieve GitHub issues event data in parallel. These functions enable the identification of active participation and expertise, which are essential indicators of a contributor's engagement in a project.

Utilize the 'searchAllIssues' function when queries pertain to issues to analyze problems or work done for a project. This function is key in elucidating the extent of a contributor's involvement and their domain knowledge within the project.

Utilize the 'searchIssuesByRepoName' function when queries pertain to issues in a specific repository to analyze problems and work done for a project. This function is key in elucidating the extent of a contributor's involvement and their domain knowledge within the project.

Utilize the 'searchIssuesByAuthor' function when queries pertain to issues from a specific user problems raised and work done for a project. This function is key in elucidating the extent of a contributor's involvement and their domain knowledge within a specific project. This will only return data for that specific GitHub user.

Utilize the 'searchIssuesByRepoNameAndAuthor' function when queries pertain to issues in specific repositories and further narrow down the search by a specific repo name. Use this to analyze user engagement and the intricacies of contributions. This function is key in elucidating the extent of a contributor's involvement and their domain knowledge within a specific project for a specific user.

In instances where the query lacks specificity, such as missing repository names or technology stacks, infer intelligently from the provided context, user input, and your own knowledge to enrich the response appropriately, without conjecture or misrepresentation. Use the 'searchAllIssues' function when all else fails.

When faced with vague queries, use contextual cues and known data to deduce missing details like repository names or technologies. Avoid assumptions; only infer what can be logically concluded from the information provided.

Summarize issue data concisely, focusing on the core contributions and omitting bot-generated content and extraneous details.

Craft responses that are informative and accessible to diverse stakeholders in the open-source community, including maintainers, contributors, and community managers.`;

    // directly call the function if the agent can decide based on the prompt
    const shortCircuitDecision = await this.openAIWrappedService.decideShortCircuitTool(
      systemMessage,
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
      .runTools(systemMessage, agentParams.prompt, tools)
      .on("message", (msg) => console.log("issues agent msg", msg))
      .on("functionCall", (functionCall) => console.log("issues agent functionCall", functionCall))
      .on("functionCallResult", (functionCallResult) =>
        console.log("issues agent functionCallResult", functionCallResult)
      );

    return runner.finalContent();
  }
}
