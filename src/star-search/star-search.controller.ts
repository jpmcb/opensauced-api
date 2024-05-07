import { Body, Controller, Post, Sse } from "@nestjs/common";
import { ApiOperation, ApiBadRequestResponse, ApiBody, ApiTags } from "@nestjs/swagger";

import { Observable } from "rxjs";
import { StarSearchService } from "./star-search.service";
import { StarSearchStreamDto } from "./dtos/create-star-search.dto";
import { StarSearchToolsService } from "./star-search-tools.service";

@Controller("star-search")
@ApiTags("Star Search Service")
export class StarSearchController {
  constructor(
    private readonly starSearchToolsService: StarSearchToolsService,
    private readonly starSerachService: StarSearchService
  ) {}

  @Post("stream")
  @Sse("stream")
  @ApiOperation({
    operationId: "generateStarSearchStream",
    summary: "Generates a star search stream",
  })
  @ApiBadRequestResponse({ description: "Invalid request" })
  @ApiBody({ type: StarSearchStreamDto })
  starSearchStream(@Body() options: StarSearchStreamDto): Observable<{ data: string }> {
    const stream = this.starSearchToolsService.runTools(options.query_text);

    return new Observable<{ data: string }>((observer) => {
      stream
        .on("content", (delta) => {
          observer.next({
            data: delta,
          });
        })
        .on("message", (msg) => console.log("msg", msg))
        .on("functionCall", (functionCall) => console.log("functionCall", functionCall))
        .on("functionCallResult", (functionCallResult) => console.log("functionCallResult", functionCallResult));

      stream
        .finalChatCompletion()
        .then(() => observer.complete())
        .catch(() => observer.complete());

      return () => stream.abort();
    });
  }
}
