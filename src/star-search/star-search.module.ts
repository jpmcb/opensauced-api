import { Module, forwardRef } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OpenAIWrappedModule } from "../openai-wrapped/openai-wrapped.module";
import { TimescaleModule } from "../timescale/timescale.module";
import { RepoModule } from "../repo/repo.module";
import { UrlModule } from "../url/url.module";
import { StarSearchController } from "./star-search.controller";
import { StarSearchToolsService } from "./star-search-tools.service";
import { BingSearchAgent } from "./agents/bing-search.agent";
import { PullRequestAgent } from "./agents/pull-request.agent";
import { IssuesAgent } from "./agents/issues.agent";
import { ReleaseAgent } from "./agents/releases.agent";
import { PreProcessorAgent } from "./agents/pre-processor.agent";
import { StarSearchThreadService } from "./star-search-thread.service";
import { DbStarSearchThread } from "./entities/thread.entity";
import { DbStarSearchUserThread } from "./entities/user-thread.entity";
import { DbStarSearchThreadHistory } from "./entities/thread-history.entity";
import { ThreadSummaryAgent } from "./agents/thread-summary.agent";
import { StarSearchWorkspaceThreadService } from "./star-search-workspace-thread.service";
import { StarSearchUserThreadService } from "./star-search-user-thread.service";
import { StarSearchSseService } from "./star-search-sse.service";
import { DbStarSearchWorkspaceThread } from "./entities/worspace-thread.entity";
import { StarSearchWorkspaceToolsService } from "./star-search-workspace-tools.service";

@Module({
  imports: [
    forwardRef(() => RepoModule),
    HttpModule,
    TimescaleModule,
    OpenAIWrappedModule,
    UrlModule,
    TypeOrmModule.forFeature(
      [DbStarSearchThread, DbStarSearchUserThread, DbStarSearchThreadHistory, DbStarSearchWorkspaceThread],
      "ApiConnection"
    ),
  ],
  providers: [
    BingSearchAgent,
    IssuesAgent,
    PreProcessorAgent,
    PullRequestAgent,
    ReleaseAgent,
    ThreadSummaryAgent,
    StarSearchSseService,
    StarSearchToolsService,
    StarSearchThreadService,
    StarSearchUserThreadService,
    StarSearchWorkspaceThreadService,
    StarSearchWorkspaceToolsService,
  ],
  exports: [
    BingSearchAgent,
    StarSearchToolsService,
    StarSearchThreadService,
    StarSearchSseService,
    StarSearchUserThreadService,
    StarSearchWorkspaceThreadService,
  ],
  controllers: [StarSearchController],
})
export class StarSearchModule {}
