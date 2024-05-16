import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { OpenAIWrappedModule } from "../openai-wrapped/openai-wrapped.module";
import { TimescaleModule } from "../timescale/timescale.module";
import { RepoModule } from "../repo/repo.module";
import { StarSearchController } from "./star-search.controller";
import { StarSearchToolsService } from "./star-search-tools.service";
import { BingSearchAgent } from "./agents/bing-search.agent";
import { PullRequestAgent } from "./agents/pull-request.agent";
import { IssuesAgent } from "./agents/issues.agent";
import { ReleaseAgent } from "./agents/releases.agent";

@Module({
  imports: [HttpModule, TimescaleModule, OpenAIWrappedModule, RepoModule],
  providers: [BingSearchAgent, IssuesAgent, PullRequestAgent, ReleaseAgent, StarSearchToolsService],
  exports: [BingSearchAgent, StarSearchToolsService],
  controllers: [StarSearchController],
})
export class StarSearchModule {}
