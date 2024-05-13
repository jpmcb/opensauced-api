import { Body, Controller, Post, Sse } from "@nestjs/common";
import { ApiOperation, ApiBadRequestResponse, ApiBody, ApiTags } from "@nestjs/swagger";

import { Observable } from "rxjs";
import { ChatCompletionMessage } from "openai/resources";
import { StarSearchStreamDto } from "./dtos/create-star-search.dto";
import { StarSearchToolsService } from "./star-search-tools.service";

enum StarSearchObservableEventTypeEnum {
  content = "content",
  function_call = "function_call",
}

interface StarSearchObservable {
  data: string | object;
  id?: string;
  type?: StarSearchObservableEventTypeEnum;
  retry?: number;
}

@Controller("star-search")
@ApiTags("Star Search Service")
export class StarSearchController {
  constructor(private readonly starSearchToolsService: StarSearchToolsService) {}

  @Post("stream")
  @Sse("stream")
  @ApiOperation({
    operationId: "generateStarSearchStream",
    summary: "Generates a star search stream",
  })
  @ApiBadRequestResponse({ description: "Invalid request" })
  @ApiBody({ type: StarSearchStreamDto })
  starSearchStream(@Body() options: StarSearchStreamDto): Observable<StarSearchObservable> {
    const stream = this.starSearchToolsService.runTools(options.query_text);

    return new Observable<StarSearchObservable>((observer) => {
      stream
        .on("content", (delta) => {
          observer.next({
            type: StarSearchObservableEventTypeEnum.content,
            data: delta,
          });
        })
        .on("message", (msg) => console.log("msg", msg))
        .on("functionCall", (functionCall: ChatCompletionMessage.FunctionCall) => {
          console.log("functionCall", functionCall);
          observer.next({
            type: StarSearchObservableEventTypeEnum.function_call,
            data: JSON.stringify(functionCall),
          });
        })
        .on("functionCallResult", (functionCallResult) => console.log("functionCallResult", functionCallResult));

      stream
        .finalChatCompletion()
        .then(() => observer.complete())
        .catch(() => observer.complete());

      return () => stream.abort();
    });
  }
}
