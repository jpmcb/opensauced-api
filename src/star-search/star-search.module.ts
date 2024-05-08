import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { OpenAIWrappedModule } from "../openai-wrapped/openai-wrapped.module";
import { TimescaleModule } from "../timescale/timescale.module";
import { StarSearchService } from "./star-search.service";
import { StarSearchController } from "./star-search.controller";
import { StarSearchToolsService } from "./star-search-tools.service";
import { BingSearchToolsSearch } from "./bing-search-tools.service";

@Module({
  imports: [HttpModule, TimescaleModule, OpenAIWrappedModule],
  providers: [BingSearchToolsSearch, StarSearchService, StarSearchToolsService],
  exports: [BingSearchToolsSearch, StarSearchService, StarSearchToolsService],
  controllers: [StarSearchController],
})
export class StarSearchModule {}
