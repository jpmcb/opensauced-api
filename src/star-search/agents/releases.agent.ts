import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OpenAIWrappedService } from "../../openai-wrapped/openai-wrapped.service";
import { ToolFunction } from "../types/toolfunction.type";
import { ReleaseGithubEventsService } from "../../timescale/release_github_events.service";
import { ReleaseAgentParams, ReleasesInDatasetParams, ReleasesParams } from "../schemas/releases.schema";

@Injectable()
export class ReleaseAgent {
  agentSystemMessage: string;

  constructor(
    private configService: ConfigService,
    private openAIWrappedService: OpenAIWrappedService,
    private releaseGithubEventsService: ReleaseGithubEventsService
  ) {
    this.agentSystemMessage = this.configService.get("starsearch.releaseAgentSystemMessage")!;
  }

  async getReleasesByReponame({ repoName }: ReleasesParams) {
    const results = await this.releaseGithubEventsService.getReleases({
      repos: repoName,
      range: 30,
      skip: 0,
    });

    if (results.length === 0) {
      return "no releases found";
    }
  }

  async getReleasesInDataset({ dataset }: ReleasesInDatasetParams) {
    const results = await this.releaseGithubEventsService.getReleases({
      repos: dataset.join(","),
      range: 30,
      skip: 0,
    });

    if (results.length === 0) {
      return "no releases found";
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private shortCircuitToolsMap = new Map<string, ToolFunction<any>>([
    ["getReleasesByReponame", this.getReleasesByReponame.bind(this)],
    ["getReleasesInDataset", this.getReleasesInDataset.bind(this)],
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

      this.openAIWrappedService.makeRunnableToolFunction({
        function: async (params: ReleasesInDatasetParams) => this.getReleasesInDataset(params),
        schema: ReleasesInDatasetParams,
        name: "getReleasesInDataset",
        description:
          "Gets the latest GitHub releases and their context within the given dataset. Repo names within the dataset be of the form: 'organization/name'. Example: facebook/react. A dataset is an array made up of several repo names. Example ['facebook/react','microsoft/vscode']. The 'author' parameter is the GitHub login of a specific user.",
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
        console.log("release agent short-circuit selected", selectedTool);
        return selectedTool(shortCircuitDecision.validatedParams);
      }
    }

    const runner = this.openAIWrappedService
      .runTools(this.agentSystemMessage, agentParams.prompt, tools)
      .on("message", (msg) => console.log("release agent msg", msg))
      .on("functionCall", (functionCall) => console.log("release agent functionCall", functionCall))
      .on("functionCallResult", (functionCallResult) =>
        console.log("release agent functionCallResult", functionCallResult)
      );

    return runner.finalContent();
  }
}
