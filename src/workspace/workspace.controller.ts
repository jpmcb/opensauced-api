import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import {
  ApiOperation,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiBearerAuth,
  ApiTags,
  ApiBadRequestResponse,
  ApiParam,
  ApiUnprocessableEntityResponse,
  ApiBody,
} from "@nestjs/swagger";

import { PageOptionsDto } from "../common/dtos/page-options.dto";
import { PageDto } from "../common/dtos/page.dto";
import { OptionalUserId, UserId } from "../auth/supabase.user.decorator";
import { SupabaseGuard } from "../auth/supabase.guard";

import { PassthroughSupabaseGuard } from "../auth/passthrough-supabase.guard";
import { DbInsight } from "../insight/entities/insight.entity";
import { DbUserList } from "../user-lists/entities/user-list.entity";
import { WorkspaceService } from "./workspace.service";
import { DbWorkspace } from "./entities/workspace.entity";
import { CreateWorkspaceDto } from "./dtos/create-workspace.dto";
import { UpdateWorkspaceDto } from "./dtos/update-workspace.dto";
import { WorkspaceInsightsService } from "./workspace-insights.service";
import { WorkspaceUserListsService } from "./workspace-user-lists.service";
import { WorkspaceReposService } from "./workspace-repos.service";

@Controller("workspaces")
@ApiTags("Workspaces service")
export class WorkspaceController {
  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly workspaceInsightsService: WorkspaceInsightsService,
    private readonly workspaceListsService: WorkspaceUserListsService,
    private readonly workspaceReposService: WorkspaceReposService
  ) {}

  @Get("/")
  @ApiOperation({
    operationId: "getWorkspaceForUser",
    summary: "Gets workspaces for the authenticated user",
  })
  @ApiBearerAuth()
  @UseGuards(SupabaseGuard)
  @ApiOkResponse({ type: DbWorkspace })
  @ApiNotFoundResponse({ description: "Unable to get user workspaces" })
  @ApiBadRequestResponse({ description: "Invalid request" })
  async getWorkspacesForUser(
    @UserId() userId: number,
    @Query() pageOptionsDto: PageOptionsDto
  ): Promise<PageDto<DbWorkspace>> {
    return this.workspaceService.findAllByUserId(pageOptionsDto, userId);
  }

  @Get("/:id")
  @ApiOperation({
    operationId: "getWorkspaceByIdForUser",
    summary: "Gets a workspace for the authenticated user and public workspaces for all users",
  })
  @ApiBearerAuth()
  @UseGuards(PassthroughSupabaseGuard)
  @ApiOkResponse({ type: DbWorkspace })
  @ApiNotFoundResponse({ description: "Unable to get user workspace" })
  @ApiBadRequestResponse({ description: "Invalid request" })
  @ApiParam({ name: "id", type: "string" })
  async getWorkspaceByIdForUser(
    @Param("id", ParseUUIDPipe) id: string,
    @OptionalUserId() userId: number | undefined
  ): Promise<DbWorkspace> {
    const workspace = await this.workspaceService.findOneByIdGuarded(id, userId);

    let overLimit = false;

    if (!workspace.payee_user_id) {
      const repositories = await this.workspaceReposService.findAllReposByWorkspaceIdForUserId({ skip: 0 }, id, userId);
      const repositoryInsights = await this.workspaceInsightsService.findAllInsightsByWorkspaceIdForUserId(
        { skip: 0 },
        id,
        userId
      );
      const contributorInsights = await this.workspaceListsService.findAllUserListsByWorkspaceIdForUserId(
        { skip: 0 },
        id,
        userId
      );

      const overWorkspaceRepoLimit = repositories.meta.itemCount > 100;
      const overRepoLimit = !!repositoryInsights.data.find(
        (repoInsight?: DbInsight) => repoInsight?.repos && repoInsight.repos.length > 20
      );
      const overContributorLimit = !!contributorInsights.data.find(
        (contributorInsight?: DbUserList) =>
          contributorInsight?.contributors && contributorInsight.contributors.length > 10
      );

      if (overRepoLimit || overContributorLimit || overWorkspaceRepoLimit) {
        overLimit = true;
      }
    }

    workspace.exceeds_upgrade_limits = overLimit;

    return workspace;
  }

  @Post("/")
  @ApiOperation({
    operationId: "createWorkspaceForUser",
    summary: "Create a new workspace for the authenticated user",
  })
  @ApiBearerAuth()
  @UseGuards(SupabaseGuard)
  @ApiOkResponse({ type: DbWorkspace })
  @ApiBadRequestResponse({ description: "Invalid request" })
  async createWorkspaceForUser(@UserId() userId: number, @Body() createWorkspaceDto: CreateWorkspaceDto) {
    return this.workspaceService.createWorkspace(createWorkspaceDto, userId);
  }

  @Patch("/:id")
  @ApiOperation({
    operationId: "updateWorkspaceForUser",
    summary: "Updates a workspace for the authenticated user",
  })
  @ApiBearerAuth()
  @UseGuards(SupabaseGuard)
  @ApiOkResponse({ type: DbWorkspace })
  @ApiNotFoundResponse({ description: "Unable to update workspace" })
  @ApiUnprocessableEntityResponse({ description: "Unable to process workspace" })
  @ApiBody({ type: UpdateWorkspaceDto })
  @ApiParam({ name: "id", type: "string" })
  async updateWorkspaceForUser(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() updateWorkspaceDto: UpdateWorkspaceDto,
    @UserId() userId: number
  ): Promise<DbWorkspace> {
    return this.workspaceService.updateWorkspace(id, updateWorkspaceDto, userId);
  }

  @Delete("/:id")
  @ApiOperation({
    operationId: "deleteWorkspaceForUser",
    summary: "Deletes a workspace for the authenticated user",
  })
  @ApiBearerAuth()
  @UseGuards(SupabaseGuard)
  @ApiNotFoundResponse({ description: "Unable to delete workspace" })
  @ApiBadRequestResponse({ description: "Invalid request" })
  @ApiParam({ name: "id", type: "string" })
  async deleteWorkspaceForUser(@Param("id", ParseUUIDPipe) id: string, @UserId() userId: number) {
    return this.workspaceService.deleteWorkspace(id, userId);
  }
}
