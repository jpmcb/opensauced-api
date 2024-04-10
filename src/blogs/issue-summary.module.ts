import { Module } from "@nestjs/common";
import { OpenAIWrappedModule } from "../openai-wrapped/openai-wrapped.module";
import { BlogSummaryService } from "./blog-summary.service";
import { BlogSummaryController } from "./issue-summary.controller";

@Module({
  imports: [OpenAIWrappedModule],
  controllers: [BlogSummaryController],
  providers: [BlogSummaryService],
  exports: [BlogSummaryService],
})
export class BlogSummaryModule {}
