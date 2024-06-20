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
  ApiTags,
  ApiBearerAuth,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiBody,
  ApiParam,
} from "@nestjs/swagger";

import { Observable } from "rxjs";
import { UpdateStarSearchThreadHistoryDto } from "../star-search/dtos/update-thread-history.dto";
import { UserId } from "../auth/supabase.user.decorator";
import { PageDto } from "../common/dtos/page.dto";
import { SupabaseGuard } from "../auth/supabase.guard";
import { PageOptionsDto } from "../common/dtos/page-options.dto";
import { DbStarSearchThread } from "../star-search/entities/thread.entity";
import { UpdateStarSearchThreadDto } from "../star-search/dtos/update-thread.dto";
import { StarSearchStreamDto } from "../star-search/dtos/create-star-search.dto";
import { StarSearchResult } from "../star-search/interfaces/results.interface";
import { StarSearchSseService } from "../star-search/star-search-sse.service";
import { WorkspaceStarSearchService } from "./workspace-starsearch.service";
import { WorkspaceReposService } from "./workspace-repos.service";

@Controller("workspaces/:id/star-search")
@ApiTags("Workspace star-search service")
export class WorkspaceStarSearchController {
  constructor(
    private readonly workspaceReposService: WorkspaceReposService,
    private readonly workspaceStarSearchService: WorkspaceStarSearchService,
    private readonly starSearchSseService: StarSearchSseService
  ) {}

  @Get("/")
  @ApiOperation({
    operationId: "getWorkspaceStarSearchThreadsForUser",
    summary: "Gets StarSearch threads in the workspace for the authenticated user",
  })
  @ApiBearerAuth()
  @UseGuards(SupabaseGuard)
  @ApiOkResponse({ type: DbStarSearchThread })
  @ApiNotFoundResponse({ description: "Unable to get user StarSearch threads" })
  @ApiBadRequestResponse({ description: "Invalid request" })
  async getStarSearchThreadsForUser(
    @Param("id", ParseUUIDPipe) id: string,
    @UserId() userId: number,
    @Query() pageOptionsDto: PageOptionsDto
  ): Promise<PageDto<DbStarSearchThread>> {
    return this.workspaceStarSearchService.findAllByWorkspaceId(pageOptionsDto, id, userId);
  }

  @Get("/:threadId")
  @ApiOperation({
    operationId: "getStarSearchWorkspaceThreadById",
    summary: "Gets a StarSearch Workspace thread for the authenticated/unauthenticated user",
  })
  @ApiBearerAuth()
  @UseGuards(SupabaseGuard)
  @ApiOkResponse({ type: DbStarSearchThread })
  @ApiNotFoundResponse({ description: "Unable to get workspace StarSearch thread" })
  @ApiBadRequestResponse({ description: "Invalid request" })
  @ApiParam({ name: "id", type: "string" })
  async getStarSearchWorkspaceThreadByIdForUser(
    @Param("id", ParseUUIDPipe) workspaceId: string,
    @Param("threadId", ParseUUIDPipe) threadId: string,
    @UserId() userId: number
  ): Promise<DbStarSearchThread> {
    return this.workspaceStarSearchService.findOneByIdWithHistory({ workspaceId, threadId, userId });
  }

  @Patch("/:threadId")
  @ApiOperation({
    operationId: "updateStarSearchWorkspaceThreadById",
    summary: "Updates a StarSearch Workspace thread for the authenticated user",
  })
  @ApiBearerAuth()
  @UseGuards(SupabaseGuard)
  @ApiOkResponse({ type: DbStarSearchThread })
  @ApiBody({ type: UpdateStarSearchThreadDto })
  @ApiNotFoundResponse({ description: "Unable to update StarSearch Workspace thread" })
  @ApiBadRequestResponse({ description: "Invalid request" })
  @ApiParam({ name: "id", type: "string" })
  async updateStarSearchWorkspaceThreadByIdForUser(
    @Body() options: UpdateStarSearchThreadDto,
    @UserId() userId: number,
    @Param("id", ParseUUIDPipe) workspaceId: string,
    @Param("threadId", ParseUUIDPipe) threadId: string
  ): Promise<DbStarSearchThread> {
    return this.workspaceStarSearchService.updateWorkspaceThread({
      workspaceId,
      threadId,
      userId,
      title: options.title ?? "",
      isArchived: options.archive ?? null,
    });
  }

  @Post("/")
  @ApiOperation({
    operationId: "createStarSearchWorkspaceThreadForUser",
    summary: "Create a new StarSearch Workspace thread for the authenticated user",
  })
  @ApiBearerAuth()
  @UseGuards(SupabaseGuard)
  @ApiOkResponse({ type: DbStarSearchThread })
  @ApiBadRequestResponse({ description: "Invalid request" })
  async createStarSearchWorkspaceThreadForUser(
    @UserId() userId: number,
    @Param("id", ParseUUIDPipe) workspaceId: string
  ) {
    return this.workspaceStarSearchService.createWorkspaceThread({ workspaceId, userId });
  }

  @Post(":threadId/stream")
  @Sse("stream")
  @ApiOperation({
    operationId: "starSearchWorkspaceStream",
    summary: "Generates a StarSearch Workspace stream",
  })
  @ApiBearerAuth()
  @UseGuards(SupabaseGuard)
  @ApiBadRequestResponse({ description: "Invalid request" })
  @ApiBody({ type: StarSearchStreamDto })
  async starSearchStream(
    @Param("id", ParseUUIDPipe) workspaceId: string,
    @Param("threadId", ParseUUIDPipe) threadId: string,
    @UserId() userId: number,
    @Body() options: StarSearchStreamDto
  ): Promise<Observable<StarSearchResult>> {
    const thread = await this.workspaceStarSearchService.findOneByIdWithHistory({
      workspaceId,
      threadId,
      userId,
    });

    const workspaceRepos = await this.workspaceReposService.findAllReposByWorkspaceIdUnguarded(workspaceId);

    return this.starSearchSseService.run({
      thread,
      queryText: options.query_text,
      dataset: workspaceRepos.map((repo) => repo.repo.full_name),
    });
  }

  @Patch(":threadId/history/:historyId")
  @ApiOperation({
    operationId: "updateStarSearchWorkspaceThreadHistoryForUser",
    summary: "Updates a StarSearch Workspace thread's history message's metadata and mood for the authenticated user",
  })
  @ApiBearerAuth()
  @UseGuards(SupabaseGuard)
  @ApiOkResponse({ type: DbStarSearchThread })
  @ApiBadRequestResponse({ description: "Invalid request" })
  @ApiBody({ type: UpdateStarSearchThreadHistoryDto })
  @ApiParam({ name: "id", type: "string" })
  async updateStarSearchWorkspaceThreadHistoryForUser(
    @Body() options: UpdateStarSearchThreadHistoryDto,
    @UserId() userId: number,
    @Param("id", ParseUUIDPipe) workspaceId: string,
    @Param("threadId", ParseUUIDPipe) threadId: string,
    @Param("historyId", ParseUUIDPipe) historyId: string
  ) {
    return this.workspaceStarSearchService.updateWorkspaceThreadHistory({
      workspaceId,
      threadId,
      historyId,
      userId,
      mood: options.mood ?? 0,
    });
  }

  @Delete("/:threadId")
  @ApiOperation({
    operationId: "deleteStarSearchWorkspaceThreadForUser",
    summary: "Deletes a StarSearch Workspace thread for the authenticated user",
  })
  @ApiBearerAuth()
  @UseGuards(SupabaseGuard)
  @ApiNotFoundResponse({ description: "Unable to delete StarSearch thread" })
  @ApiBadRequestResponse({ description: "Invalid request" })
  @ApiParam({ name: "id", type: "string" })
  @ApiParam({ name: "threadId", type: "string" })
  async deleteStarSearchThreadForUser(
    @Param("id", ParseUUIDPipe) workspaceId: string,
    @Param("threadId", ParseUUIDPipe) threadId: string,
    @UserId() userId: number
  ) {
    return this.workspaceStarSearchService.deleteWorkspaceThread({
      workspaceId,
      threadId,
      userId,
    });
  }
}
