import { BadRequestException, Body, Controller, Post, Sse } from "@nestjs/common";
import { ApiOperation, ApiBadRequestResponse, ApiBody, ApiTags } from "@nestjs/swagger";

import { Observable } from "rxjs";
import { ChatCompletionMessage } from "openai/resources";
import { StarSearchStreamDto } from "./dtos/create-star-search.dto";
import { StarSearchToolsService } from "./star-search-tools.service";
import { PreProcessorAgent } from "./agents/pre-processor.agent";
import { isPreProcessorError } from "./schemas/pre-processor.schema";
import { StarSearchEventTypeEnum, StarSearchPayload, StarSearchPayloadStatusEnum } from "./types/star-search.type";

interface StarSearchObservable {
  data: StarSearchPayload;
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

    let message = "";

    return new Observable<StarSearchObservable>((observer) => {
      stream
        .on("content", (delta) => {
          message += delta;

          observer.next({
            data: {
              id: "123-abc",
              author: "manager",
              iso_time: new Date().toISOString(),
              content: {
                type: StarSearchEventTypeEnum.content,
                parts: [message],
              },
              status: StarSearchPayloadStatusEnum.in_progress,
              error: null,
            },
          });
        })
        .on("message", (msg) => console.log("manager msg", msg))
        .on("functionCall", (functionCall: ChatCompletionMessage.FunctionCall) => {
          console.log("manager functionCall", functionCall);

          observer.next({
            data: {
              id: "789-xyz",
              author: "manager",
              iso_time: new Date().toISOString(),
              content: {
                type: StarSearchEventTypeEnum.function_call,
                parts: [JSON.stringify(functionCall)],
              },
              status: StarSearchPayloadStatusEnum.in_progress,
              error: null,
            },
          });
        })
        .on("functionCallResult", (functionCallResult) =>
          console.log("manager functionCallResult", functionCallResult)
        );

      stream
        .finalChatCompletion()
        .then(() => {
          observer.next({
            data: {
              id: "final-id",
              author: "manager",
              iso_time: new Date().toISOString(),
              content: {
                type: StarSearchEventTypeEnum.final,
                parts: [message],
              },
              status: StarSearchPayloadStatusEnum.done,
              error: null,
            },
          });

          return observer.complete();
        })
        .catch(() => observer.complete());

      return () => stream.abort();
    });
  }
}
