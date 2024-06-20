import {
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
import { PassthroughSupabaseGuard } from "../auth/passthrough-supabase.guard";
import { OptionalUserId, UserId } from "../auth/supabase.user.decorator";
import { PageDto } from "../common/dtos/page.dto";
import { SupabaseGuard } from "../auth/supabase.guard";
import { PageOptionsDto } from "../common/dtos/page-options.dto";
import { StarSearchStreamDto } from "./dtos/create-star-search.dto";
import { DbStarSearchThread } from "./entities/thread.entity";
import { StarSearchThreadService } from "./star-search-thread.service";
import { UpdateStarSearchThreadHistoryDto } from "./dtos/update-thread-history.dto";
import { UpdateStarSearchThreadDto } from "./dtos/update-thread.dto";
import { StarSearchUserThreadService } from "./star-search-user-thread.service";
import { StarSearchSseService } from "./star-search-sse.service";
import { StarSearchResult } from "./interfaces/results.interface";

@Controller("star-search")
@ApiTags("Star Search Service")
export class StarSearchController {
  constructor(
    private readonly starSearchThreadsService: StarSearchThreadService,
    private readonly starSearchUserThreadsService: StarSearchUserThreadService,
    private readonly starSearchSseService: StarSearchSseService
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
    return this.starSearchUserThreadsService.findUserThreads(pageOptionsDto, userId);
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
    @Param("id", ParseUUIDPipe) threadId: string,
    @OptionalUserId() userId: number | undefined
  ): Promise<DbStarSearchThread> {
    return this.starSearchUserThreadsService.findPublicThreadWithHistoryByIdForUser({ threadId, userId });
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
    @Param("id", ParseUUIDPipe) threadId: string
  ): Promise<DbStarSearchThread> {
    await this.starSearchUserThreadsService.findThreadByIdForUser({ threadId, userId });

    return this.starSearchThreadsService.updateThreadById({
      threadId,
      title: options.title ?? "",
      isArchived: options.archive ?? null,
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
    return this.starSearchUserThreadsService.createUserThread(userId);
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
  @ApiParam({ name: "id", type: "string" })
  async makeStarSearchThreadPublicForUser(@Param("id", ParseUUIDPipe) threadId: string, @UserId() userId: number) {
    return this.starSearchUserThreadsService.makeThreadPublicByIdForUser({
      threadId,
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
  @ApiParam({ name: "id", type: "string" })
  async makeStarSearchThreadPrivateForUser(@Param("id", ParseUUIDPipe) threadId: string, @UserId() userId: number) {
    return this.starSearchUserThreadsService.makeThreadPrivateByIdForUser({
      threadId,
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
  @ApiParam({ name: "id", type: "string" })
  async starSearchStream(
    @Param("id", ParseUUIDPipe) id: string,
    @UserId() userId: number,
    @Body() options: StarSearchStreamDto
  ): Promise<Observable<StarSearchResult>> {
    const thread = await this.starSearchUserThreadsService.findThreadWithHistoryByIdForUser(id, userId);

    return this.starSearchSseService.run({ thread, queryText: options.query_text });
  }

  @Patch(":id/history/:historyId")
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
  @ApiParam({ name: "historyId", type: "string" })
  async updateStarSearchThreadHistoryForUser(
    @Body() options: UpdateStarSearchThreadHistoryDto,
    @UserId() userId: number,
    @Param("id", ParseUUIDPipe) threadId: string,
    @Param("historyId", ParseUUIDPipe) historyId: string
  ) {
    await this.starSearchUserThreadsService.findThreadByIdForUser({ threadId, userId });

    return this.starSearchThreadsService.updateThreadHistory({
      threadId,
      historyId,
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
  async deleteStarSearchThreadForUser(@Param("id", ParseUUIDPipe) threadId: string, @UserId() userId: number) {
    await this.starSearchUserThreadsService.findThreadByIdForUser({ threadId, userId });

    return this.starSearchUserThreadsService.deleteUserThread({ threadId, userId });
  }
}
