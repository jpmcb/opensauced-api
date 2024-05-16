import { Injectable } from "@nestjs/common";
import { OpenAIWrappedService } from "../../openai-wrapped/openai-wrapped.service";
import { ToolFunction } from "../types/toolfunction.type";
import { ReleaseGithubEventsService } from "../../timescale/release_github_events.service";
import { ReleaseAgentParams, ReleasesParams } from "../schemas/releases.schema";

@Injectable()
export class ReleaseAgent {
  constructor(
    private openAIWrappedService: OpenAIWrappedService,
    private releaseGithubEventsService: ReleaseGithubEventsService
  ) {}

  async getReleasesByReponame({ repoName }: ReleasesParams) {
    return this.releaseGithubEventsService.getReleases({
      repos: repoName,
      range: 30,
      skip: 0,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private shortCircuitToolsMap = new Map<string, ToolFunction<any>>([
    ["getReleasesByReponame", this.getReleasesByReponame.bind(this)],

    /*
     * todo - create additional short-circuit calls that can be made
     */
  ]);

  async runAgentTools(agentParams: ReleaseAgentParams): Promise<string | null | unknown> {
    const tools = [
      this.openAIWrappedService.makeRunnableToolFunction({
        function: async (params: ReleasesParams) => this.getReleasesByReponame(params),
        schema: ReleasesParams,
        name: "getReleasesByReponame",
        description:
          "Gets the latest GitHub releases and their context for a specific repository. The repoName parameter should be of the form: 'organization/name'. Example: facebook/react.",
      }),
    ];

    const systemMessage = `You are the OpenSauced "Release AI Agent". Your purpose is to interact with other AI agent callers that are querying you for information and insights about GitHub releases.

In your toolkit, you have multiple functions designed to retrieve GitHub release events data in parallel. These functions enable you to gain an understanding of releases across the github ecosystem.

Utilize the 'getReleasesByReponame' function when queries pertain to releases in specific repositories`;

    // directly call the function if the agent can decide based on the prompt
    const shortCircuitDecision = await this.openAIWrappedService.decideShortCircuitTool(
      systemMessage,
      agentParams.prompt,
      tools
    );

    if (shortCircuitDecision?.name) {
      const selectedTool = this.shortCircuitToolsMap.get(shortCircuitDecision.name);

      if (selectedTool) {
        console.log("release agent short-circuit selected", selectedTool);
        return selectedTool(shortCircuitDecision.validatedParams);
      }
    }

    const runner = this.openAIWrappedService
      .runTools(systemMessage, agentParams.prompt, tools)
      .on("message", (msg) => console.log("release agent msg", msg))
      .on("functionCall", (functionCall) => console.log("release agent functionCall", functionCall))
      .on("functionCallResult", (functionCallResult) =>
        console.log("release agent functionCallResult", functionCallResult)
      );

    return runner.finalContent();
  }
}
