import { Injectable } from "@nestjs/common";
import { OpenAIWrappedService } from "../../openai-wrapped/openai-wrapped.service";
import { PullRequestGithubEventsVectorService } from "../../timescale/pull_request_github-events_vector.service";
import {
  PullRequestAgentParams,
  SearchAllPrsParams,
  SearchPrsByAuthorParams,
  SearchPrsByRepoNameAndAuthorParams,
  SearchPrsByRepoNameParams,
} from "../schemas/pull-requests.schema";
import { ToolFunction } from "../types/toolfunction.type";

@Injectable()
export class PullRequestAgent {
  constructor(
    private openAIWrappedService: OpenAIWrappedService,
    private pullRequestGithubEventsVectorService: PullRequestGithubEventsVectorService
  ) {}

  private async searchAllPrs({ question }: SearchAllPrsParams) {
    const queryEmbedding = await this.openAIWrappedService.generateEmbedding(question);

    return this.pullRequestGithubEventsVectorService.cosineSimilarity({
      embedding: queryEmbedding,
      range: 30,
      prevDaysStartDate: 0,
    });
  }

  private async searchPrsByRepoName({ question, repoName }: SearchPrsByRepoNameParams) {
    const queryEmbedding = await this.openAIWrappedService.generateEmbedding(question);

    return this.pullRequestGithubEventsVectorService.cosineSimilarity({
      embedding: queryEmbedding,
      range: 30,
      prevDaysStartDate: 0,
      repoName,
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
      repoName,
      author,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private shortCircuitToolsMap = new Map<string, ToolFunction<any>>([
    ["searchAllPrs", this.searchAllPrs.bind(this)],
    ["searchPrsByRepoName", this.searchPrsByRepoName.bind(this)],
    ["searchPrsByAuthor", this.searchPrsByAuthor.bind(this)],
    ["searchPrsByRepoNameAndAuthor", this.searchPrsByRepoNameAndAuthor.bind(this)],
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
        function: async (params: SearchPrsByRepoNameParams) => this.searchPrsByRepoName(params),
        schema: SearchPrsByRepoNameParams,
        name: "searchPrsByRepoName",
        description:
          "Searches GitHub pull requests and their context for a specific repository. Returns relevant summaries of pull requests based on the input user question. The repoName parameter should be of the form: 'organization/name'. Example: facebook/react.",
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
    ];

    const systemMessage = `You are a 'Pull Request AI Agent'. Your purpose is to interact with other AI agent callers that are querying you for information and insights into GitHub pull requests.

In your toolkit, you have multiple functions designed to retrieve GitHub pull requsts event data in parallel. These functions enable the identification of active participation and expertise through PullRequestEvents, which are essential indicators of a contributor's engagement in a project.

Utilize the 'searchAllPrs' function when queries pertain to issues and pull requests to analyze user engagement and the intricacies of contributions. This function is key in elucidating the extent of a contributor's involvement and their domain knowledge within the project.

Utilize the 'searchPrsByRepoName' function when queries pertain to pull requests and work in a specific repository to analyze user engagement and the intricacies of contributions. This function is key in elucidating the extent of a contributor's involvement and their domain knowledge within the project.

Utilize the 'searchPrsByAuthor' function when queries pertain to pull requests and work for a specific user to analyze user engagement and the intricacies of contributions. This function is key in elucidating the extent of a contributor's involvement and their domain knowledge within a specific project. This will only return data for that specific repository.

Utilize the 'searchPrsByRepoNameAndAuthor' function when queries pertain to pull requests and work in specific repositories and further narrow dow the search by a specific repo name. Use this to analyze user engagement and the intricacies of contributions. This function is key in elucidating the extent of a contributor's involvement and their domain knowledge within a specific project for a specific user.

In instances where the query lacks specificity, such as missing repository names or technology stacks, infer intelligently from the provided context, user input, and your own knowledge to enrich the response appropriately, without conjecture or misrepresentation. Use the 'searchAllPrs' function when all else fails.

When faced with vague queries, use contextual cues and known data to deduce missing details like repository names or technologies. Avoid assumptions; only infer what can be logically concluded from the information provided.

Summarize pull request data concisely, focusing on the core contributions and omitting bot-generated content and extraneous details.

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
        console.log("pull request agent short-circuit selected", selectedTool);
        return selectedTool(shortCircuitDecision.validatedParams);
      }
    }

    const runner = this.openAIWrappedService
      .runTools(systemMessage, agentParams.prompt, tools)
      .on("message", (msg) => console.log("pull req agent msg", msg))
      .on("functionCall", (functionCall) => console.log("pull req agent functionCall", functionCall))
      .on("functionCallResult", (functionCallResult) =>
        console.log("pull req agent functionCallResult", functionCallResult)
      );

    return runner.finalContent();
  }
}
