import { Module } from "@nestjs/common";
import { OpenAIWrappedModule } from "../openai-wrapped/openai-wrapped.module";
import { IssueSummaryService } from "./issue-summary.service";
import { IssueSummaryController } from "./issue-summary.controller";

@Module({
  imports: [OpenAIWrappedModule],
  controllers: [IssueSummaryController],
  providers: [IssueSummaryService],
  exports: [IssueSummaryService],
})
export class IssueSummaryModule {}
