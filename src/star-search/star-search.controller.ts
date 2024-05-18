import { BadRequestException, Body, Controller, Post, Sse } from "@nestjs/common";
import { ApiOperation, ApiBadRequestResponse, ApiBody, ApiTags } from "@nestjs/swagger";

import { Observable } from "rxjs";
import { ChatCompletionMessage } from "openai/resources";
import { StarSearchStreamDto } from "./dtos/create-star-search.dto";
import { StarSearchToolsService } from "./star-search-tools.service";
import { PreProcessorAgent } from "./agents/pre-processor.agent";
import { isPreProcessorError } from "./schemas/pre-processor.schema";

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
  constructor(
    private readonly starSearchToolsService: StarSearchToolsService,
    private readonly preProcessAgent: PreProcessorAgent
  ) {}

  @Post("stream")
  @Sse("stream")
  @ApiOperation({
    operationId: "generateStarSearchStream",
    summary: "Generates a star search stream",
  })
  @ApiBadRequestResponse({ description: "Invalid request" })
  @ApiBody({ type: StarSearchStreamDto })
  async starSearchStream(@Body() options: StarSearchStreamDto): Promise<Observable<StarSearchObservable>> {
    const preProcessResults = await this.preProcessAgent.preProcessPrompt({ prompt: options.query_text });

    if (!preProcessResults) {
      throw new BadRequestException();
    }

    if (isPreProcessorError(preProcessResults)) {
      throw new BadRequestException(`error: ${preProcessResults.error}`);
    }

    const stream = this.starSearchToolsService.runTools(preProcessResults.prompt);

    return new Observable<StarSearchObservable>((observer) => {
      stream
        .on("content", (delta) => {
          observer.next({
            type: StarSearchObservableEventTypeEnum.content,
            data: delta,
          });
        })
        .on("message", (msg) => console.log("manager msg", msg))
        .on("functionCall", (functionCall: ChatCompletionMessage.FunctionCall) => {
          console.log("manager functionCall", functionCall);
          observer.next({
            type: StarSearchObservableEventTypeEnum.function_call,
            data: JSON.stringify(functionCall),
          });
        })
        .on("functionCallResult", (functionCallResult) =>
          console.log("manager functionCallResult", functionCallResult)
        );

      stream
        .finalChatCompletion()
        .then(() => observer.complete())
        .catch(() => observer.complete());

      return () => stream.abort();
    });
  }
}
