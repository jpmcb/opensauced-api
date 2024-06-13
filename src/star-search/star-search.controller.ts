import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Sse,
  UseGuards,
} from "@nestjs/common";
import {
  ApiOperation,
  ApiBadRequestResponse,
  ApiBody,
  ApiTags,
  ApiBearerAuth,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiParam,
} from "@nestjs/swagger";

import { Observable } from "rxjs";
import { ChatCompletionMessage } from "openai/resources";
import { PassthroughSupabaseGuard } from "../auth/passthrough-supabase.guard";
import { OptionalUserId, UserId } from "../auth/supabase.user.decorator";
import { PageDto } from "../common/dtos/page.dto";
import { SupabaseGuard } from "../auth/supabase.guard";
import { PageOptionsDto } from "../common/dtos/page-options.dto";
import { OpenAIWrappedService } from "../openai-wrapped/openai-wrapped.service";
import { StarSearchStreamDto } from "./dtos/create-star-search.dto";
import { StarSearchToolsService } from "./star-search-tools.service";
import { PreProcessorAgent } from "./agents/pre-processor.agent";
import { isPreProcessorError } from "./schemas/pre-processor.schema";
import {
  StarSearchActorEnum,
  StarSearchEventTypeEnum,
  StarSearchPayload,
  StarSearchPayloadStatusEnum,
} from "./types/star-search.type";
import { DbStarSearchThread } from "./entities/thread.entity";
import { StarSearchThreadService } from "./star-search-thread.service";
import { ThreadSummaryAgent } from "./agents/thread-summary.agent";
import { UpdateStarSearchThreadHistoryDto } from "./dtos/update-thread-history.dto";
import { UpdateStarSearchThreadDto } from "./dtos/update-thread.dto";

interface StarSearchResult {
  data: StarSearchPayload;
}

@Controller("star-search")
@ApiTags("Star Search Service")
export class StarSearchController {
  constructor(
    private readonly openAIWrappedService: OpenAIWrappedService,
    private readonly starSearchThreadsService: StarSearchThreadService,
    private readonly starSearchToolsService: StarSearchToolsService,
    private readonly preProcessAgent: PreProcessorAgent,
    private readonly threadSummaryAgent: ThreadSummaryAgent
  ) {}

  @Get("/")
  @ApiOperation({
    operationId: "getStarSearchThreadsForUser",
    summary: "Gets StarSearch threads for the authenticated user",
  })
  @ApiBearerAuth()
  @UseGuards(SupabaseGuard)
  @ApiOkResponse({ type: DbStarSearchThread })
  @ApiNotFoundResponse({ description: "Unable to get user StarSearch threads" })
  @ApiBadRequestResponse({ description: "Invalid request" })
  async getStarSearchThreadsForUser(
    @Query() pageOptionsDto: PageOptionsDto,
    @UserId() userId: number
  ): Promise<PageDto<DbStarSearchThread>> {
    return this.starSearchThreadsService.findUserThreads(pageOptionsDto, userId);
  }

  @Get("/:id")
  @ApiOperation({
    operationId: "getStarSearchThreadByIdForUser",
    summary: "Gets a possibly public StarSearch thread for the authenticated/unauthenticated user",
  })
  @ApiBearerAuth()
  @UseGuards(PassthroughSupabaseGuard)
  @ApiOkResponse({ type: DbStarSearchThread })
  @ApiNotFoundResponse({ description: "Unable to get user StarSearch thread" })
  @ApiBadRequestResponse({ description: "Invalid request" })
  @ApiParam({ name: "id", type: "string" })
  async getStarSearchThreadByIdForUser(
    @Param("id", ParseUUIDPipe) id: string,
    @OptionalUserId() userId: number | undefined
  ): Promise<DbStarSearchThread> {
    return this.starSearchThreadsService.findPublicThreadWithHistoryByIdForUser(id, userId);
  }

  @Patch("/:id")
  @ApiOperation({
    operationId: "updateStarSearchThreadByIdForUser",
    summary: "Updates a StarSearch thread for the authenticated user",
  })
  @ApiBearerAuth()
  @UseGuards(SupabaseGuard)
  @ApiOkResponse({ type: DbStarSearchThread })
  @ApiBody({ type: UpdateStarSearchThreadDto })
  @ApiNotFoundResponse({ description: "Unable to update user StarSearch thread" })
  @ApiBadRequestResponse({ description: "Invalid request" })
  @ApiParam({ name: "id", type: "string" })
  async updateStarSearchThreadByIdForUser(
    @Body() options: UpdateStarSearchThreadDto,
    @UserId() userId: number,
    @Param("id", ParseUUIDPipe) id: string
  ): Promise<DbStarSearchThread> {
    return this.starSearchThreadsService.updateThreadByIdForUser({
      id,
      userId,
      title: options.title ?? "",
      is_archived: options.archive ?? null,
    });
  }

  @Post("/")
  @ApiOperation({
    operationId: "createStarSearchThreadForUser",
    summary: "Create a new StarSearch thread for the authenticated user",
  })
  @ApiBearerAuth()
  @UseGuards(SupabaseGuard)
  @ApiOkResponse({ type: DbStarSearchThread })
  @ApiBadRequestResponse({ description: "Invalid request" })
  async createStarSearchThreadForUser(@UserId() userId: number) {
    return this.starSearchThreadsService.createThread(userId);
  }

  @Post(":id/share")
  @ApiOperation({
    operationId: "makeStarSearchThreadPublicForUser",
    summary: "Makes the given StarSearch thread public. Returns shortlink.",
  })
  @ApiBearerAuth()
  @UseGuards(SupabaseGuard)
  @ApiOkResponse({ type: DbStarSearchThread })
  @ApiBadRequestResponse({ description: "Invalid request" })
  async makeStarSearchThreadPublicForUser(@Param("id", ParseUUIDPipe) id: string, @UserId() userId: number) {
    return this.starSearchThreadsService.makeThreadPublicByIdForUser({
      id,
      userId,
    });
  }

  @Post(":id/unshare")
  @ApiOperation({
    operationId: "makeStarSearchThreadPrivateForUser",
    summary: "Makes the given StarSearch thread private",
  })
  @ApiBearerAuth()
  @UseGuards(SupabaseGuard)
  @ApiOkResponse({ type: DbStarSearchThread })
  @ApiBadRequestResponse({ description: "Invalid request" })
  async makeStarSearchThreadPrivateForUser(@Param("id", ParseUUIDPipe) id: string, @UserId() userId: number) {
    return this.starSearchThreadsService.makeThreadPrivateByIdForUser({
      id,
      userId,
    });
  }

  @Post(":id/stream")
  @Sse("stream")
  @ApiOperation({
    operationId: "starSearchStream",
    summary: "Generates a star search stream",
  })
  @ApiBearerAuth()
  @UseGuards(SupabaseGuard)
  @ApiBadRequestResponse({ description: "Invalid request" })
  @ApiBody({ type: StarSearchStreamDto })
  async starSearchStream(
    @Param("id", ParseUUIDPipe) id: string,
    @UserId() userId: number,
    @Body() options: StarSearchStreamDto
  ): Promise<Observable<StarSearchResult>> {
    /*
     * get the metadata for this StarSearch thread
     */

    const thread = await this.starSearchThreadsService.findThreadWithHistoryByIdForUser(id, userId);
    const lastMessage = thread.thread_history[0]?.message ?? "";
    const threadSummary = thread.thread_summary ?? "";

    /*
     * run the pre-processor agent to validate the incoming prompt, check for
     * prompt injection attempts, and cleanup the user's query
     */
    const preProcessResults = await this.preProcessAgent.preProcessPrompt({
      prompt: options.query_text,
      threadSummary,
      lastMessage,
    });

    if (!preProcessResults) {
      throw new BadRequestException();
    }

    if (isPreProcessorError(preProcessResults)) {
      throw new BadRequestException(`error: ${preProcessResults.error}`);
    }

    /*
     * kick off the StarSearch manager
     */

    const stream = this.starSearchToolsService.runTools({
      question: preProcessResults.prompt,
      lastMessage,
      threadSummary,
    });

    /*
     * add the current user prompt to the thread history
     */

    const newUserHistory = await this.starSearchThreadsService.newThreadHistory(thread.id);

    const userContent = {
      data: {
        id: newUserHistory.id,
        author: StarSearchActorEnum.user,
        iso_time: new Date().toISOString(),
        content: {
          type: StarSearchEventTypeEnum.user_prompt,
          parts: [options.query_text],
        },
        status: StarSearchPayloadStatusEnum.recieved_user_query,
        error: null,
      },
    };

    const userQueryEmbedding = await this.openAIWrappedService.generateEmbedding(options.query_text);

    await this.starSearchThreadsService.addToThreadHistory({
      id: newUserHistory.id,
      type: StarSearchEventTypeEnum.user_prompt,
      message: JSON.stringify(userContent.data),
      actor: StarSearchActorEnum.user,
      embedding: userQueryEmbedding,
    });

    const newAgentContentHistory = await this.starSearchThreadsService.newThreadHistory(thread.id);

    let message = "";

    return new Observable<StarSearchResult>((observer) => {
      stream
        .on("content", (delta) => {
          message += delta;

          observer.next({
            data: {
              id: newAgentContentHistory.id,
              author: StarSearchActorEnum.manager,
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
        .on("functionCall", async (functionCall: ChatCompletionMessage.FunctionCall) => {
          console.log("manager functionCall", functionCall);

          const functionCallContent = {
            data: {
              id: newAgentContentHistory.id,
              author: StarSearchActorEnum.manager,
              iso_time: new Date().toISOString(),
              content: {
                type: StarSearchEventTypeEnum.function_call,
                parts: [JSON.stringify(functionCall)],
              },
              status: StarSearchPayloadStatusEnum.in_progress,
              error: null,
            },
          };

          observer.next(functionCallContent);

          /*
           * add the function call (with it's message payload) to the thread history
           * so that a client can replay the enriched UI for that specific function call
           */

          const newAgentFuncCallHistory = await this.starSearchThreadsService.newThreadHistory(thread.id);

          await this.starSearchThreadsService.addToThreadHistory({
            id: newAgentFuncCallHistory.id,
            type: StarSearchEventTypeEnum.function_call,
            message: JSON.stringify(functionCallContent.data),
            actor: StarSearchActorEnum.manager,
          });
        })
        .on("functionCallResult", (functionCallResult) =>
          console.log("manager functionCallResult", functionCallResult)
        );

      stream
        .finalChatCompletion()
        .then(async () => {
          const finalContent = {
            data: {
              id: newAgentContentHistory.id,
              author: StarSearchActorEnum.manager,
              iso_time: new Date().toISOString(),
              content: {
                type: StarSearchEventTypeEnum.final,
                parts: [message],
              },
              status: StarSearchPayloadStatusEnum.done,
              error: null,
            },
          };

          // done sending SSEs, can finalize observer and cleanup async
          observer.next(finalContent);
          observer.complete();

          const historyMessages = thread.thread_history.slice(0, 5).map((history) => history.message ?? "");

          /*
           * add the final content to the thread history
           */

          const llmResponseEmbedding = await this.openAIWrappedService.generateEmbedding(message);

          await this.starSearchThreadsService.addToThreadHistory({
            id: newAgentContentHistory.id,
            type: StarSearchEventTypeEnum.final,
            message: JSON.stringify(finalContent.data),
            actor: StarSearchActorEnum.manager,
            embedding: llmResponseEmbedding,
          });

          /*
           * update the thread summary / title based on the recent history
           */

          const thread_summary = await this.threadSummaryAgent.generateThreadSummary({
            messages: [message, ...historyMessages],
            previousSummary: thread.thread_summary ?? "",
            previousTitle: thread.title ?? "",
          });

          const title = await this.threadSummaryAgent.generateThreadTitle({
            messages: [message, ...historyMessages],
            previousSummary: thread.thread_summary ?? "",
            previousTitle: thread.title ?? "",
          });

          await this.starSearchThreadsService.updateThreadByIdForUser({
            id: thread.id,
            userId,
            thread_summary,
            title,
          });

          return undefined;
        })
        .catch(() => observer.complete());

      return () => stream.abort();
    });
  }

  @Patch(":threadId/history/:id")
  @ApiOperation({
    operationId: "updateStarSearchThreadHistoryForUser",
    summary: "Updates a StarSearch history message's metadata and mood for the authenticated user",
  })
  @ApiBearerAuth()
  @UseGuards(SupabaseGuard)
  @ApiOkResponse({ type: DbStarSearchThread })
  @ApiBadRequestResponse({ description: "Invalid request" })
  @ApiBody({ type: UpdateStarSearchThreadHistoryDto })
  @ApiParam({ name: "id", type: "string" })
  async updateStarSearchThreadHistoryForUser(
    @Body() options: UpdateStarSearchThreadHistoryDto,
    @UserId() userId: number,
    @Param("threadId", ParseUUIDPipe) threadId: string,
    @Param("id", ParseUUIDPipe) threadHistoryId: string
  ) {
    return this.starSearchThreadsService.updateThreadHistory({
      threadId,
      threadHistoryId,
      userId,
      mood: options.mood ?? 0,
    });
  }

  @Delete("/:id")
  @ApiOperation({
    operationId: "deleteStarSearchThreadForUser",
    summary: "Deletes a StarSearch thread for the authenticated user",
  })
  @ApiBearerAuth()
  @UseGuards(SupabaseGuard)
  @ApiNotFoundResponse({ description: "Unable to delete StarSearch thread" })
  @ApiBadRequestResponse({ description: "Invalid request" })
  @ApiParam({ name: "id", type: "string" })
  async deleteStarSearchThreadForUser(@Param("id", ParseUUIDPipe) id: string, @UserId() userId: number) {
    return this.starSearchThreadsService.deleteThread(id, userId);
  }
}
