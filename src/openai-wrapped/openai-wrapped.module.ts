import { Module } from "@nestjs/common";
import { OpenAIWrappedService } from "./openai-wrapped.service";

@Module({
  providers: [OpenAIWrappedService],
  exports: [OpenAIWrappedService],
})
export class OpenAIWrappedModule {}
