import { Injectable } from "@nestjs/common";
import { z } from "zod";
import { ChatCompletionStreamingRunner } from "openai/lib/ChatCompletionStreamingRunner";
import { RepoService } from "../repo/repo.service";
import { ReleaseGithubEventsService } from "../timescale/release_github_events.service";
import { PullRequestGithubEventsVectorService } from "../timescale/pull_request_github-events_vector.service";
import { OpenAIWrappedService } from "../openai-wrapped/openai-wrapped.service";
import { IssuesGithubEventsVectorService } from "../timescale/issues_github-events_vector.service";
import { BingSearchToolsSearch } from "./bing-search-tools.service";

export const RenderLottoFactorParams = z.object({
  repoName: z.string(),
});
export type RenderLottoFactorParams = z.infer<typeof RenderLottoFactorParams>;

/*
 * ---------------
 * PRs schemas
 */

export const SearchAllPrsParams = z.object({
  question: z.string(),
});
export type SearchAllPrsParams = z.infer<typeof SearchAllPrsParams>;

export const SearchPrsByRepoNameParams = z.object({
  question: z.string(),
  repoName: z.string(),
});
export type SearchPrsByRepoNameParams = z.infer<typeof SearchPrsByRepoNameParams>;

export const SearchPrsByAuthorParams = z.object({
  question: z.string(),
  author: z.string(),
});
export type SearchPrsByAuthorParams = z.infer<typeof SearchPrsByAuthorParams>;

export const SearchPrsByRepoNameAndAuthorParams = z.object({
  question: z.string(),
  repoName: z.string(),
  author: z.string(),
});
export type SearchPrsByRepoNameAndAuthorParams = z.infer<typeof SearchPrsByRepoNameAndAuthorParams>;

/*
 * ---------------
 * Issues schema
 */

export const SearchAllIssuesParams = z.object({
  question: z.string(),
});
export type SearchAllIssuesParams = z.infer<typeof SearchAllIssuesParams>;

export const SearchIssuesByRepoNameParams = z.object({
  question: z.string(),
  repoName: z.string(),
});
export type SearchIssuesByRepoNameParams = z.infer<typeof SearchIssuesByRepoNameParams>;

export const SearchIssuesByAuthorParams = z.object({
  question: z.string(),
  author: z.string(),
});
export type SearchIssuesByAuthorParams = z.infer<typeof SearchIssuesByAuthorParams>;

export const SearchIssuesByRepoNameAndAuthorParams = z.object({
  question: z.string(),
  repoName: z.string(),
  author: z.string(),
});
export type SearchIssuesByRepoNameAndAuthorParams = z.infer<typeof SearchIssuesByRepoNameAndAuthorParams>;

/*
 * ---------------
 * Releases schema
 */

export const ReleasesParams = z.object({
  repoName: z.string(),
});
export type ReleasesParams = z.infer<typeof ReleasesParams>;

/*
 * ---------------
 * Bing search schema
 */

export const SearchBingParams = z.object({
  query: z.string(),
});
export type SearchBingParams = z.infer<typeof SearchBingParams>;

@Injectable()
export class StarSearchToolsService {
  constructor(
    private repoService: RepoService,
    private openAIWrappedService: OpenAIWrappedService,
    private bingSearchToolsService: BingSearchToolsSearch,
    private pullRequestGithubEventsVectorService: PullRequestGithubEventsVectorService,
    private issuesGithubEventsVectorService: IssuesGithubEventsVectorService,
    private releaseGithubEventsService: ReleaseGithubEventsService
  ) {}

  /*
   * ---------------
   * Client signals to render components
   */

  async renderLottoFactor({ repoName }: RenderLottoFactorParams) {
    return this.repoService.findLottoFactor({ repos: repoName });
  }

  /*
   * ---------------
   * PRs functions
   */

  async searchAllPrs({ question }: SearchAllPrsParams) {
    const queryEmbedding = await this.openAIWrappedService.generateEmbedding(question);

    return this.pullRequestGithubEventsVectorService.cosineSimilarity({
      embedding: queryEmbedding,
      range: 30,
      prevDaysStartDate: 0,
    });
  }

  async searchPrsByRepoName({ question, repoName }: SearchPrsByRepoNameParams) {
    const queryEmbedding = await this.openAIWrappedService.generateEmbedding(question);

    return this.pullRequestGithubEventsVectorService.cosineSimilarity({
      embedding: queryEmbedding,
      range: 30,
      prevDaysStartDate: 0,
      repoName,
    });
  }

  async searchPrsByAuthor({ question, author }: SearchPrsByAuthorParams) {
    const queryEmbedding = await this.openAIWrappedService.generateEmbedding(question);

    return this.pullRequestGithubEventsVectorService.cosineSimilarity({
      embedding: queryEmbedding,
      range: 30,
      prevDaysStartDate: 0,
      author,
    });
  }

  async searchPrsByRepoNameAndAuthor({ question, repoName, author }: SearchPrsByRepoNameAndAuthorParams) {
    const queryEmbedding = await this.openAIWrappedService.generateEmbedding(question);

    return this.pullRequestGithubEventsVectorService.cosineSimilarity({
      embedding: queryEmbedding,
      range: 30,
      prevDaysStartDate: 0,
      repoName,
      author,
    });
  }

  /*
   * ---------------
   * Issues functions
   */

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

  /*
   * ---------------
   * Releases functions
   */

  async getReleasesByReponame({ repoName }: ReleasesParams) {
    return this.releaseGithubEventsService.getReleases({
      repos: repoName,
      range: 30,
      skip: 0,
    });
  }

  /*
   * ---------------
   * Bing search functions
   */

  async searchBing({ query }: SearchBingParams) {
    return this.bingSearchToolsService.bingSearch(query);
  }

  runTools(question: string): ChatCompletionStreamingRunner {
    const tools = [
      /*
       * ---------------
       * Misc tools
       */
      this.openAIWrappedService.zodFunction({
        function: async (params: RenderLottoFactorParams) => this.renderLottoFactor(params),
        schema: RenderLottoFactorParams,
        name: "renderLottoFactor",
        description:
          "Signals to clients that they should render a Lottery Factor graph component: the Lottery Factor component is a visualization of the distribution of contributions and shows the risk profile of repositories most active contributors suddenly no longer being available, putting that project's future in jeopardy.",
      }),

      /*
       * ---------------
       * PRs tools
       */
      this.openAIWrappedService.zodFunction({
        function: async (params: SearchAllPrsParams) => this.searchAllPrs(params),
        schema: SearchAllPrsParams,
        name: "searchAllPrs",
        description:
          "Searches all GitHub pull requests and their context. Returns relevant summaries of pull requests based on the input user question.",
      }),

      this.openAIWrappedService.zodFunction({
        function: async (params: SearchPrsByRepoNameParams) => this.searchPrsByRepoName(params),
        schema: SearchPrsByRepoNameParams,
        name: "searchPrsByRepoName",
        description:
          "Searches GitHub pull requests and their context for a specific repository. Returns relevant summaries of pull requests based on the input user question. The repoName parameter should be of the form: 'organization/name'. Example: facebook/react.",
      }),

      this.openAIWrappedService.zodFunction({
        function: async (params: SearchPrsByAuthorParams) => this.searchPrsByAuthor(params),
        schema: SearchPrsByAuthorParams,
        name: "searchPrsByAuthor",
        description:
          "Searches GitHub pull requests and their context by a specific PR author. Returns relevant summaries of pull requests based on the input user question. The 'author' parameter is the GitHub login of a specific user.",
      }),

      this.openAIWrappedService.zodFunction({
        function: async (params: SearchPrsByRepoNameAndAuthorParams) => this.searchPrsByRepoNameAndAuthor(params),
        schema: SearchPrsByRepoNameAndAuthorParams,
        name: "searchPrsByRepoNameAndAuthor",
        description:
          "Searches GitHub pull requests and their context in a specific repository and by a specific PR author. Returns relevant summaries of pull requests based on the input user question. The repoName parameter should be of the form: 'organization/name'. Example: facebook/react. The 'author' parameter is the GitHub login of a specific user.",
      }),

      /*
       * ---------------
       * Issues tools
       */

      this.openAIWrappedService.zodFunction({
        function: async (params: SearchAllIssuesParams) => this.searchAllIssues(params),
        schema: SearchAllIssuesParams,
        name: "searchAllIssues",
        description:
          "Searches all GitHub issues and their context. Returns relevant summaries of issues based on the input user question.",
      }),

      this.openAIWrappedService.zodFunction({
        function: async (params: SearchIssuesByRepoNameParams) => this.searchIssuesByRepoName(params),
        schema: SearchIssuesByRepoNameParams,
        name: "searchIssuesByRepoName",
        description:
          "Searches GitHub issues and their context for a specific repository. Returns relevant summaries of issues based on the input user question. The repoName parameter should be of the form: 'organization/name'. Example: facebook/react.",
      }),

      this.openAIWrappedService.zodFunction({
        function: async (params: SearchIssuesByAuthorParams) => this.searchIssuesByAuthor(params),
        schema: SearchIssuesByAuthorParams,
        name: "searchIssuesByAuthor",
        description:
          "Searches GitHub issues and their context by a specific issue author. Returns relevant summaries of issues based on the input user question. The 'author' parameter is the GitHub login of a specific user.",
      }),

      this.openAIWrappedService.zodFunction({
        function: async (params: SearchIssuesByRepoNameAndAuthorParams) => this.searchIssuesByRepoNameAndAuthor(params),
        schema: SearchIssuesByRepoNameAndAuthorParams,
        name: "searchIssuesByRepoNameAndAuthor",
        description:
          "Searches GitHub issues and their context in a specific repository and by a specific issue author. Returns relevant summaries of issues based on the input user question. The repoName parameter should be of the form: 'organization/name'. Example: facebook/react. The 'author' parameter is the GitHub login of a specific user.",
      }),

      /*
       * ---------------
       * Releases tools
       */

      this.openAIWrappedService.zodFunction({
        function: async (params: ReleasesParams) => this.getReleasesByReponame(params),
        schema: ReleasesParams,
        name: "getReleasesByReponame",
        description:
          "Gets the latest GitHub releases and their context for a specific repository. The repoName parameter should be of the form: 'organization/name'. Example: facebook/react.",
      }),

      /*
       * ---------------
       * Bing search tools
       */

      this.openAIWrappedService.zodFunction({
        function: async (params: SearchBingParams) => this.searchBing(params),
        schema: SearchBingParams,
        name: "searchBing",
        description: "Search Bing using an input query.",
      }),
    ];

    const systemMessage = `As an OpenSauced AI assistant, your purpose is to answer the user's queries by discerning impactful open-source contributors, including those often overlooked, within the GitHub community by analyzing GitHub Events data that you will be given.

In your toolkit, you have multiple functions designed to retrieve GitHub event data in parallel, aligning with OpenSauced's mission to surface diverse contributions within the open-source community. These functions enable the identification of active participation and expertise through IssueEvents and PullRequestEvents, which are essential indicators of a contributor's engagement in a project.

Use the 'renderLottoFactor' function when queries ask about the "Lottery Factor" for certain repositories or about the risk profile of certain projects important individuals suddently disappearing. This function signals to clients that it should render a Lottery Factor graph for a specific repository.

Utilize the 'searchAllPrs' function when queries pertain to issues and pull requests to analyze user engagement and the intricacies of contributions. This function is key in elucidating the extent of a contributor's involvement and their domain knowledge within the project.

Utilize the 'searchPrsByRepoName' function when queries pertain to pull requests and work in a specific repository to analyze user engagement and the intricacies of contributions. This function is key in elucidating the extent of a contributor's involvement and their domain knowledge within the project.

Utilize the 'searchPrsByAuthor' function when queries pertain to pull requests and work for a specific user to analyze user engagement and the intricacies of contributions. This function is key in elucidating the extent of a contributor's involvement and their domain knowledge within a specific project. This will only return data for that specific repository.

Utilize the 'searchPrsByRepoNameAndAuthor' function when queries pertain to pull requests and work in specific repositories and further narrow dow the search by a specific repo name. Use this to analyze user engagement and the intricacies of contributions. This function is key in elucidating the extent of a contributor's involvement and their domain knowledge within a specific project for a specific user.

Utilize the 'searchAllIssues' function when queries pertain to issues to analyze problems or work done for a project. This function is key in elucidating the extent of a contributor's involvement and their domain knowledge within the project.

Utilize the 'searchIssuesByRepoName' function when queries pertain to issues in a specific repository to analyze problems and work done for a project. This function is key in elucidating the extent of a contributor's involvement and their domain knowledge within the project.

Utilize the 'searchIssuesByAuthor' function when queries pertain to issues from a specific user problems raised and work done for a project. This function is key in elucidating the extent of a contributor's involvement and their domain knowledge within a specific project. This will only return data for that specific GitHub user.

Utilize the 'searchIssuesByRepoNameAndAuthor' function when queries pertain to issues in specific repositories and further narrow down the search by a specific repo name. Use this to analyze user engagement and the intricacies of contributions. This function is key in elucidating the extent of a contributor's involvement and their domain knowledge within a specific project for a specific user.

Utilize the 'getReleaseGithubEvents' function when queries pertain to releases and queries about new releases of a specific repositories code.

Utilize the 'searchBing' function when user queries need additional context outside of what would be known on GitHub (like talks given by people, blog posts written by contributors, etc.). These searches should be tailored to find software developers and people in the open source community.

In instances where the query lacks specificity, such as missing repository names or technology stacks, infer intelligently from the provided context, user input, and your own knowledge to enrich the response appropriately, without conjecture or misrepresentation. Use the 'searchAllPrs' function when all else fails.

When faced with vague queries, use contextual cues and known data to deduce missing details like repository names or technologies. Avoid assumptions; only infer what can be logically concluded from the information provided.

Summarize pull request data concisely, focusing on the core contributions and omitting bot-generated content and extraneous details.

Craft responses that are informative and accessible to diverse stakeholders in the open-source community, including maintainers, contributors, and community managers.`;

    return this.openAIWrappedService.runTools(systemMessage, question, tools);
  }
}
