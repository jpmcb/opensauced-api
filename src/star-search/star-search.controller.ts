import { Body, Controller, Post, Sse } from "@nestjs/common";
import { ApiOperation, ApiBadRequestResponse, ApiBody, ApiTags } from "@nestjs/swagger";

import { Observable } from "rxjs";
import { StarSearchService } from "./star-search.service";
import { StarSearchStreamDto } from "./dtos/create-star-search.dto";

@Controller("star-search")
@ApiTags("Star Search Service")
export class StarSearchController {
  constructor(private readonly starSerachService: StarSearchService) {}

  @Post("stream")
  @Sse("stream")
  @ApiOperation({
    operationId: "generateStarSearchStream",
    summary: "Generates a star search stream",
  })
  @ApiBadRequestResponse({ description: "Invalid request" })
  @ApiBody({ type: StarSearchStreamDto })
  async starSearchStream(@Body() options: StarSearchStreamDto): Promise<Observable<{ data: string }>> {
    const stream = await this.starSerachService.starSearchStream(options);

    return new Observable<{ data: string }>((observer) => {
      stream.on("content", (delta) => {
        observer.next({
          data: delta,
        });
      });

      stream
        .finalChatCompletion()
        .then(() => observer.complete())
        .catch(() => observer.complete());

      return () => stream.abort();
    });
  }
}
