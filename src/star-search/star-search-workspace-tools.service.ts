import { Injectable } from "@nestjs/common";
import { ChatCompletionStreamingRunner } from "openai/lib/ChatCompletionStreamingRunner";
import { ConfigService } from "@nestjs/config";
import { RepoService } from "../repo/repo.service";
import { OpenAIWrappedService } from "../openai-wrapped/openai-wrapped.service";
import { BingSearchAgent } from "./agents/bing-search.agent";
import { PullRequestAgent } from "./agents/pull-request.agent";
import { IssuesAgent } from "./agents/issues.agent";
import { ReleaseAgent } from "./agents/releases.agent";
import { RenderLottoFactorParams } from "./schemas/render-on-client.schema";
import { PullRequestAgentParams } from "./schemas/pull-requests.schema";
import { IssuesAgentParams } from "./schemas/issues.schema";
import { ReleaseAgentParams } from "./schemas/releases.schema";
import { BingSearchAgentParams } from "./schemas/bing.schema";

@Injectable()
export class StarSearchWorkspaceToolsService {
  managerSystemMessage: string;

  constructor(
    private configService: ConfigService,
    private repoService: RepoService,
    private openAIWrappedService: OpenAIWrappedService,
    private bingSearchAgent: BingSearchAgent,
    private pullRequestAgent: PullRequestAgent,
    private issuesAgent: IssuesAgent,
    private releaseAgent: ReleaseAgent
  ) {
    this.managerSystemMessage = this.configService.get("starsearch.managerSystemMessage")!;
  }

  /*
   * --------------------------------------------------------------------------
   * Client signals to render components
   */

  async renderLottoFactor({ repoName }: RenderLottoFactorParams) {
    try {
      const result = await this.repoService.findLottoFactor({ repos: repoName, range: 30 });

      return result;
    } catch (error: unknown) {
      if (error instanceof Error) {
        return `error getting lottery factor data: ${error.message}`;
      }
    }
  }

  runTools({
    question,
    lastMessage,
    threadSummary,
    dataset,
  }: {
    question: string;
    lastMessage?: string;
    threadSummary?: string;
    dataset: string[];
  }): ChatCompletionStreamingRunner {
    const tools = [
      /*
       * ----------------------------------------------------------------------
       * Misc tools
       */

      this.openAIWrappedService.makeRunnableToolFunction({
        function: async (params: RenderLottoFactorParams) => this.renderLottoFactor(params),
        schema: RenderLottoFactorParams,
        name: "renderLottoFactor",
        description: `Signals to clients that they should render a Lottery Factor graph component: the Lottery Factor component is a visualization of the distribution of contributions and shows the risk profile of a repository's most active contributors suddenly no longer being available, putting that project's future in jeopardy.`,
      }),

      /*
       * ----------------------------------------------------------------------
       * PR agent
       */

      this.openAIWrappedService.makeRunnableToolFunction({
        function: async (params: PullRequestAgentParams) => this.pullRequestAgent.runTools(params),
        schema: PullRequestAgentParams,
        name: "callPullRequestAgent",
        description: `Engages the "Pull Request AI Agent". This agent has prestine data on work done in projects and can be used to derive insights and understandings from GitHub pull requests.`,
      }),

      /*
       * ----------------------------------------------------------------------
       * Issues agent
       */

      this.openAIWrappedService.makeRunnableToolFunction({
        function: async (params: IssuesAgentParams) => this.issuesAgent.runAgentTools(params),
        schema: IssuesAgentParams,
        name: "callIssuesAgent",
        description: `Engages the "Issues AI Agent". This agent can be used to derive insights and understandings from GitHub issues.`,
      }),

      /*
       * ----------------------------------------------------------------------
       * Release agent
       */

      this.openAIWrappedService.makeRunnableToolFunction({
        function: async (params: ReleaseAgentParams) => this.releaseAgent.runAgentTools(params),
        schema: ReleaseAgentParams,
        name: "callReleaseAgent",
        description: `Engages the "Release AI Agent". This agent can be used to derive insights and understandings from GitHub releases.`,
      }),

      /*
       * ----------------------------------------------------------------------
       * Bing search agent
       */

      this.openAIWrappedService.makeRunnableToolFunction({
        function: async (params: BingSearchAgentParams) => this.bingSearchAgent.runAgentTools(params),
        schema: BingSearchAgentParams,
        name: "callBingSearchAgent",
        description: `Engages with the "Bing Search AI Agent". This agent can be used to search the internet using Bing to find information not provided by other agents or missing from their data. This agent should be used as a LAST RESORT.`,
      }),
    ];

    let userMessage = "";

    if (lastMessage && threadSummary) {
      userMessage = `Dataset:
---
[${dataset.join(", ")}]

Last message:
---
${lastMessage}

Chat history summary:
---
${threadSummary}

Prompt:
---
${question}`;
    } else {
      userMessage = `Dataset:
---
[${dataset.join(", ")}]

Last message:
---
No chat history present.

Chat history summary:
---
No chat history present.

Prompt:
---
${question}`;
    }

    return this.openAIWrappedService.runToolsStream(this.managerSystemMessage, userMessage, tools);
  }
}
