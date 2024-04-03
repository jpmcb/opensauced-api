import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { UserModule } from "../user/user.module";
import { TimescaleModule } from "../timescale/timescale.module";
import { RepoFilterModule } from "../common/filters/repo-filter.module";
import { DbReleaseGitHubEvent } from "../timescale/entities/release_github_events_histogram.entity";
import { DbRepo } from "./entities/repo.entity";
import { RepoService } from "./repo.service";
import { RepoController } from "./repo.controller";

@Module({
  imports: [
    forwardRef(() => TimescaleModule),
    forwardRef(() => UserModule),
    TypeOrmModule.forFeature([DbRepo], "ApiConnection"),
    TypeOrmModule.forFeature([DbReleaseGitHubEvent], "TimescaleConnection"),
    RepoFilterModule,
  ],
  controllers: [RepoController],
  providers: [RepoService],
  exports: [RepoService],
})
export class RepoModule {}
