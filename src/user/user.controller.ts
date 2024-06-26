import { Controller, Get, Header, Param, Query } from "@nestjs/common";
import { ApiBadRequestResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

import { PageOptionsDto } from "../common/dtos/page-options.dto";
import { PageDto } from "../common/dtos/page.dto";
import { ApiPaginatedResponse } from "../common/decorators/api-paginated-response.decorator";
import { RepoService } from "../repo/repo.service";
import { DbRepoWithStats } from "../repo/entities/repo.entity";
import { DbPullRequestGitHubEvents } from "../timescale/entities/pull_request_github_event.entity";
import { PullRequestGithubEventsService } from "../timescale/pull_request_github_events.service";
import { IssueCommentGithubEventsService } from "../timescale/issue_comment_github_events.service";
import { DbIssueCommentGitHubEvents } from "../timescale/entities/issue_comment_github_events.entity";
import { DbUserHighlight } from "./entities/user-highlight.entity";
import { UserHighlightsService } from "./user-highlights.service";
import { DbUser } from "./user.entity";
import { UserService } from "./services/user.service";
import { DbTopUser } from "./entities/top-users.entity";
import { TopUsersDto } from "./dtos/top-users.dto";
import { DbFilteredUser } from "./entities/filtered-users.entity";
import { FilteredUsersDto } from "./dtos/filtered-users.dto";
import { DbUserOrganization } from "./entities/user-organization.entity";
import { UserOrganizationService } from "./user-organization.service";
import { UserPrsDto } from "./dtos/user-prs.dto";
import { UserDto } from "./dtos/user.dto";

@Controller("users")
@ApiTags("User service")
export class UserController {
  constructor(
    private userService: UserService,
    private pullRequestGitHubEventsService: PullRequestGithubEventsService,
    private userHighlightsService: UserHighlightsService,
    private repoService: RepoService,
    private userOrganizationService: UserOrganizationService,
    private issueCommentGitHubEventsService: IssueCommentGithubEventsService
  ) {}

  @Get("/:username")
  @ApiOperation({
    operationId: "findOneUserByUserame",
    summary: "Finds a user by :username",
  })
  @ApiOkResponse({ type: DbUser })
  @ApiNotFoundResponse({ description: "User not found" })
  async findOneUserById(@Param("username") username: string, @Query() userOptions?: UserDto): Promise<DbUser> {
    return this.userService.tryFindUserOrMakeStub({ username, dto: userOptions });
  }

  @Get("/:username/devstats-refresh")
  @ApiOperation({
    operationId: "refreshOneUserDevstatsByUsername",
    summary: "Refreshes a user's devstats by :username - primarily used programmatically by the ETL",
  })
  @ApiOkResponse({ type: DbUser })
  @ApiNotFoundResponse({ description: "User not found" })
  async refreshOneUserDevstatsByUsername(@Param("username") username: string): Promise<DbUser> {
    return this.userService.refreshOneDevstatsByUsername(username);
  }

  @Get("/:username/prs")
  @ApiOperation({
    operationId: "findContributorPullRequestGitHubEvents",
    summary: "Finds pull requests by :username",
  })
  @ApiPaginatedResponse(DbPullRequestGitHubEvents)
  @ApiOkResponse({ type: DbPullRequestGitHubEvents })
  @ApiNotFoundResponse({ description: "User not found" })
  @Header("Cache-Control", "public, max-age=600")
  async findContributorPullRequestGitHubEvents(
    @Param("username") username: string,
    @Query() pageOptionsDto: UserPrsDto
  ): Promise<PageDto<DbPullRequestGitHubEvents>> {
    return this.pullRequestGitHubEventsService.findAllByPrAuthor(username, pageOptionsDto);
  }

  @Get("/:username/issue-comments")
  @ApiOperation({
    operationId: "findContributorIssueCommentsGitHubEvents",
    summary: "Finds issue comments by :username",
  })
  @ApiPaginatedResponse(DbIssueCommentGitHubEvents)
  @ApiOkResponse({ type: DbIssueCommentGitHubEvents })
  @ApiNotFoundResponse({ description: "User not found" })
  @Header("Cache-Control", "public, max-age=600")
  async findContributorIssueCommentsGitHubEvents(
    @Param("username") username: string,
    @Query() pageOptionsDto: UserPrsDto
  ): Promise<PageDto<DbIssueCommentGitHubEvents>> {
    return this.issueCommentGitHubEventsService.findAllByIssueCommentAuthor(username, pageOptionsDto);
  }

  @Get("/:username/highlights")
  @ApiOperation({
    operationId: "findAllHighlightsByUsername",
    summary: "Listing all Highlights for a user and paginate them",
  })
  @ApiPaginatedResponse(DbUserHighlight)
  @ApiOkResponse({ type: DbUserHighlight })
  @ApiNotFoundResponse({ description: "Highlights not found" })
  @Header("Cache-Control", "public, max-age=600")
  async findAllHighlightsByUsername(
    @Param("username") username: string,
    @Query() pageOptionsDto: PageOptionsDto
  ): Promise<PageDto<DbUserHighlight>> {
    const user = await this.userService.tryFindUserOrMakeStub({ username });

    return this.userHighlightsService.findAllByUserId(pageOptionsDto, user.id);
  }

  @Get("/:username/top-repos")
  @ApiOperation({
    operationId: "findAllTopReposByUsername",
    summary: "Listing all Top Repos for a user and paginate them",
  })
  @ApiPaginatedResponse(DbRepoWithStats)
  @ApiOkResponse({ type: DbRepoWithStats })
  @ApiNotFoundResponse({ description: "Top repos not found" })
  @Header("Cache-Control", "public, max-age=600")
  async findAllTopReposByUsername(
    @Param("username") username: string,
    @Query() pageOptionsDto: PageOptionsDto
  ): Promise<PageDto<DbRepoWithStats>> {
    const user = await this.userService.tryFindUserOrMakeStub({ username });

    return this.repoService.findAll(pageOptionsDto, user.id, ["TopRepos"]);
  }

  @Get("/:username/organizations")
  @ApiOperation({
    operationId: "findAllOrgsByUsername",
    summary: "Listing public orgs for a user and paginate them",
  })
  @ApiPaginatedResponse(DbUserOrganization)
  @ApiOkResponse({ type: DbUserOrganization })
  @ApiNotFoundResponse({ description: "Top repos not found" })
  @Header("Cache-Control", "public, max-age=600")
  async findAllOrgsByUsername(
    @Param("username") username: string,
    @Query() pageOptionsDto: PageOptionsDto
  ): Promise<PageDto<DbUserOrganization>> {
    const user = await this.userService.tryFindUserOrMakeStub({ username });

    return this.userOrganizationService.findAllByUserId(user.id, pageOptionsDto);
  }

  @Get("/top")
  @ApiOperation({
    operationId: "getTop10Highlights",
    summary: "List top users",
  })
  @ApiOkResponse({ type: DbTopUser })
  @Header("Cache-Control", "public, max-age=600")
  async getTopUsers(@Query() pageOptionsDto: TopUsersDto): Promise<PageDto<DbTopUser>> {
    return this.userService.findTopUsers(pageOptionsDto);
  }

  @Get("/search")
  @ApiOperation({
    operationId: "getUsersByFilter",
    summary: "Search users",
  })
  @ApiOkResponse({ type: DbFilteredUser })
  @ApiBadRequestResponse({ description: "Username is required" })
  async getUsersByFilter(@Query() pageOptionsDto: FilteredUsersDto): Promise<PageDto<DbFilteredUser>> {
    return this.userService.findUsersByFilter(pageOptionsDto);
  }
}
