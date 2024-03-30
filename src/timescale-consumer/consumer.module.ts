import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DbPullRequestGitHubEvents } from "src/timescale/entities/pull_request_github_event.entity";
import { TimescaleConsumerService } from "./consumer.service";
import { TimescaleConsumerController } from "./consumer.controller";

@Module({
  imports: [TypeOrmModule.forFeature([DbPullRequestGitHubEvents], "TimescaleConnection")],
  controllers: [TimescaleConsumerController],
  providers: [TimescaleConsumerService],
  exports: [TimescaleConsumerService],
})
export class TimescaleConsumerModule {}
