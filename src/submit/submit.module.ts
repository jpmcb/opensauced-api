import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { DbRepoWithStats } from "../repo/entities/repo.entity";
import { DbRepoToUserSubmissions } from "../repo/entities/repo.to.user.submissions.entity";
import { RepoModule } from "../repo/repo.module";
import { SubmitService } from "./submit.service";
import { RepoSubmitController } from "./repo-submit.controller";

@Module({
  imports: [TypeOrmModule.forFeature([DbRepoWithStats, DbRepoToUserSubmissions], "ApiConnection"), RepoModule],
  controllers: [RepoSubmitController],
  providers: [SubmitService],
  exports: [SubmitService],
})
export class SubmitModule {}
