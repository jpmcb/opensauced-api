import { Module } from "@nestjs/common";
import { OpenAIWrappedModule } from "../openai-wrapped/openai-wrapped.module";
import { TimescaleModule } from "../timescale/timescale.module";
import { StarSearchService } from "./star-search.service";
import { StarSearchController } from "./star-search.controller";
import { StarSearchToolsService } from "./star-search-tools.service";

@Module({
  imports: [TimescaleModule, OpenAIWrappedModule],
  providers: [StarSearchService, StarSearchToolsService],
  exports: [StarSearchService, StarSearchToolsService],
  controllers: [StarSearchController],
})
export class StarSearchModule {}
