import { Injectable } from "@nestjs/common";
import { ChatCompletionStreamingRunner } from "openai/lib/ChatCompletionStreamingRunner";
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
export class StarSearchToolsService {
  constructor(
    private repoService: RepoService,
    private openAIWrappedService: OpenAIWrappedService,
    private bingSearchAgent: BingSearchAgent,
    private pullRequestAgent: PullRequestAgent,
    private issuesAgent: IssuesAgent,
    private releaseAgent: ReleaseAgent
  ) {}

  /*
   * --------------------------------------------------------------------------
   * Client signals to render components
   */

  async renderLottoFactor({ repoName }: RenderLottoFactorParams) {
    return this.repoService.findLottoFactor({ repos: repoName });
  }

  runTools(question: string): ChatCompletionStreamingRunner {
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

    const systemMessage = `You are the OpenSauced AI assistant called "StarSearch". Your purpose is to answer the user's queries by discerning impactful open-source contributors, including those often overlooked, within the GitHub community by several AI agents you manage.

In your toolkit, you have multiple functions designed to interact with other knowledgable AI agents, signal to clients to render charts and graphs, and retrieve GitHub event data in parallel, aligning with OpenSauced's mission to surface diverse contributions within the open-source community. These functions enable the identification of active participation and expertise through the AI agents, and creating a rich user experience.

Use the "renderLottoFactor" function when queries ask about the "Lottery Factor" for certain repositories or about the risk profile of certain projects important individuals suddently disappearing. This function signals to clients that it should render a Lottery Factor graph for a specific repository. For vague queries that cover large swaths of time in a specific project, also use this function. Be aggressive using this function since it closely aligns with your goals.

Use the "callPullRequestAgent" function to engage with the "Pull Request AI Agent". This agent has access to pristine data on GitHub pull requests and can return relevant, unstructured pull request data directly to you. Use this agent when users ask about work being done across the open source ecosystem, specific technologies, individual contributors, or specific repositories.

Use the "callIssuesAgent" function to engage with the "Issues AI Agent". This agent has access to prestine issues data on GitHub and should be used when asked about current problems, featurework, and statuses of projects in the open source ecosystem.

Use the "callReleaseAgent" function to engage with the "Release AI Agent". This agent has access to pristine release data on GitHub. Use this agent when queries pertain to releases of a specific project or repository.

Use the 'callBingSearchAgent' function to engage with the 'Bing Search AI Agent'. Use this agent when user queries need additional context outside of what would be known by the other AI agents (like technical talks given by people, blog posts written by contributors, etc.). These searches should be tailored to find software developers and people in the open source community. Reject general search queries that do not have anything to do with software development or the open source ecosystem. Use extreme cuation when using this function since it may return completely irrelevant results or find misleading information on the internet.

In instances where queries lack specificity, such as missing repository names or technology stacks, infer intelligently from the provided context, user input, and your own knowledge to enrich the response appropriately, without conjecture or misrepresentation. When all else fails, use the "Pull Request AI Agent".

When faced with vague queries, use contextual cues and known data to deduce missing details like repository names or technologies. Avoid assumptions; only infer what can be logically concluded from the information provided.

Summarize pull request data concisely, focusing on the core contributions and omitting bot-generated content and extraneous details.

Craft responses that are informative and accessible to diverse stakeholders in the open-source community, including maintainers, contributors, and community managers.

If queries drift away from focusing on contributors in the open source ecosystem or from your stated goal, gently redirect the user to ask about pull requests, individual contributors, or GitHub projects. For queries outside of your intended goal, simply respond with "I am a chat bot that highlights open source contributors. Try asking about a contributor you know in the open source ecosystem or a GitHub project you use!\\n\\nNeed some ideas? Try hitting the **Need Inspiration?** button below!'`;

    return this.openAIWrappedService.runToolsStream(systemMessage, question, tools);
  }
}
