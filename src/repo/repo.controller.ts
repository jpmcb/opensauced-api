import { Controller, Get, Header, Param, ParseIntPipe, Query } from "@nestjs/common";
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { DbReleaseGitHubEvent } from "../timescale/entities/release_github_events_histogram.entity";
import { ReleaseGithubEventsService } from "../timescale/release_github_events.service";
import { ReleasesDto } from "../histogram/dtos/releases.dto";
import { PageDto } from "../common/dtos/page.dto";
import { ApiPaginatedResponse } from "../common/decorators/api-paginated-response.decorator";
import { PageOptionsDto } from "../common/dtos/page-options.dto";
import { RepoDevstatsService } from "../timescale/repo-devstats.service";
import { DbRepo, DbRepoWithStats } from "./entities/repo.entity";
import { RepoService } from "./repo.service";
import { RepoPageOptionsDto } from "./dtos/repo-page-options.dto";
import {
  RepoFuzzySearchOptionsDto,
  RepoRangeOnlyOptionDto,
  RepoRangeOptionsDto,
  RepoSearchOptionsDto,
} from "./dtos/repo-search-options.dto";
import { DbRepoContributor } from "./entities/repo_contributors.entity";
import { RepoReleaseDto } from "./dtos/repo-release.dto";
import { DbLotteryFactor } from "./entities/lotto.entity";
import { DbRepoRossIndex } from "./entities/ross.entity";
import { DbRepoYolo } from "./entities/yolo.entity";

@Controller("repos")
@ApiTags("Repository service")
export class RepoController {
  constructor(
    private readonly repoService: RepoService,
    private readonly repoDevstatsService: RepoDevstatsService,
    private readonly releaseGitHubEventsService: ReleaseGithubEventsService
  ) {}

  @Get("/:id")
  @ApiOperation({
    operationId: "findOneById",
    summary: "Finds a repo by :id",
  })
  @ApiOkResponse({ type: DbRepoWithStats })
  @ApiNotFoundResponse({ description: "Repository not found" })
  @ApiParam({ name: "id", type: "integer" })
  @Header("Cache-Control", "public, max-age=600")
  async findOneById(@Param("id", ParseIntPipe) id: number): Promise<DbRepoWithStats> {
    return this.repoService.findOneById(id);
  }

  @Get("/:owner/:repo")
  @ApiOperation({
    operationId: "findOneByOwnerAndRepo",
    summary: "Finds a repo by :owner and :repo",
  })
  @ApiOkResponse({ type: DbRepoWithStats })
  @ApiNotFoundResponse({ description: "Repository not found" })
  @Header("Cache-Control", "public, max-age=600")
  async findOneByOwnerAndRepo(
    @Param("owner") owner: string,
    @Param("repo") repo: string,
    @Query() rangeOption: RepoRangeOnlyOptionDto
  ): Promise<DbRepoWithStats> {
    return this.repoService.tryFindRepoOrMakeStub({ repoOwner: owner, repoName: repo, rangeOption });
  }

  @Get("/:owner/:repo/info")
  @ApiOperation({
    operationId: "findOneInfoByOwnerAndRepo",
    summary: "Finds a repo by :owner and :repo",
  })
  @ApiOkResponse({ type: DbRepoWithStats })
  @ApiNotFoundResponse({ description: "Repository not found" })
  @Header("Cache-Control", "public, max-age=600")
  async findOneInfoByOwnerAndRepo(
    @Param("owner") owner: string,
    @Param("repo") repo: string
  ): Promise<DbRepoWithStats> {
    return this.repoService.tryFindRepoOrMakeStub({ repoOwner: owner, repoName: repo, minimalInfo: true });
  }

  @Get("/:owner/:repo/ross")
  @ApiOperation({
    operationId: "getRepoRossIndex",
    summary: "Gets repo ross index/stats",
  })
  @ApiOkResponse({ type: DbRepoRossIndex })
  @ApiNotFoundResponse({ description: "Repository not found" })
  @Header("Cache-Control", "private, max-age=600")
  async getRepoRossIndex(
    @Param("owner") owner: string,
    @Param("repo") repo: string,
    @Query() rangeOption: RepoRangeOnlyOptionDto
  ): Promise<DbRepoRossIndex> {
    return this.repoService.findRossIndex(owner, repo, rangeOption);
  }

  @Get("/:owner/:repo/yolo")
  @ApiOperation({
    operationId: "getYoloPushes",
    summary: "Gets repo yolo coders",
  })
  @ApiOkResponse({ type: DbRepoYolo })
  @ApiNotFoundResponse({ description: "Repository not found" })
  @Header("Cache-Control", "private, max-age=600")
  async getYoloPushes(
    @Param("owner") owner: string,
    @Param("repo") repo: string,
    @Query() rangeOption: RepoRangeOnlyOptionDto
  ): Promise<DbRepoYolo> {
    return this.repoService.findYoloPushes(owner, repo, rangeOption);
  }

  @Get("/lotto")
  @ApiOperation({
    operationId: "findLottoFactorByOwnerAndRepo",
    summary: "Calcultes the lotto factor for a repo by :owner and :repo",
  })
  @ApiOkResponse({ type: DbLotteryFactor })
  @ApiNotFoundResponse({ description: "Repository not found" })
  @Header("Cache-Control", "public, max-age=600")
  async findLottoFactorByOwnerAndRepo(@Query() pageOptionsDto: RepoRangeOptionsDto): Promise<DbLotteryFactor> {
    return this.repoService.findLottoFactor(pageOptionsDto);
  }

  @Get("/:owner/:repo/contributors")
  @ApiOperation({
    operationId: "findContributorsByOwnerAndRepo",
    summary: "Finds a repo by :owner and :repo and gets the contributors",
  })
  @ApiPaginatedResponse(DbRepoContributor)
  @ApiOkResponse({ type: DbRepoContributor })
  @ApiNotFoundResponse({ description: "Repository not found" })
  @Header("Cache-Control", "public, max-age=600")
  async findContributorsByOwnerAndRepo(
    @Param("owner") owner: string,
    @Param("repo") repo: string,
    @Query() pageOptionsDto: PageOptionsDto
  ): Promise<PageDto<DbRepoContributor>> {
    return this.repoDevstatsService.findRepoContributorStats(owner, repo, pageOptionsDto);
  }

  @Get("/:owner/:repo/releases")
  @ApiOperation({
    operationId: "findReleasesByOwnerAndRepo",
    summary: "Finds a repo by :owner and :repo and gets the releases",
  })
  @ApiPaginatedResponse(DbReleaseGitHubEvent)
  @ApiOkResponse({ type: DbReleaseGitHubEvent })
  @ApiNotFoundResponse({ description: "Repository releases not found" })
  @Header("Cache-Control", "public, max-age=600")
  async findReleasesByOwnerAndRepo(
    @Param("owner") owner: string,
    @Param("repo") repo: string,
    @Query() pageOptionsDto: RepoReleaseDto
  ): Promise<PageDto<DbReleaseGitHubEvent>> {
    const options: ReleasesDto = {
      repos: `${owner}/${repo}`,
      ...pageOptionsDto,
      skip: ((pageOptionsDto.page ?? 1) - 1) * (pageOptionsDto.limit ?? 10),
    };

    return this.releaseGitHubEventsService.getPagedReleases(options);
  }

  @Get("/list")
  @ApiOperation({
    operationId: "findAll",
    summary: "Finds all repos and paginates them",
  })
  @ApiPaginatedResponse(DbRepoWithStats)
  @ApiOkResponse({ type: DbRepoWithStats })
  @Header("Cache-Control", "public, max-age=600")
  async findAll(@Query() pageOptionsDto: RepoPageOptionsDto): Promise<PageDto<DbRepoWithStats>> {
    return this.repoService.findAll(pageOptionsDto);
  }

  @Get("/search")
  @ApiOperation({
    operationId: "findAllReposWithFilters",
    summary: "Finds all repos using filters and paginates them",
  })
  @ApiPaginatedResponse(DbRepoWithStats)
  @ApiOkResponse({ type: DbRepoWithStats })
  @Header("Cache-Control", "public, max-age=600")
  async findAllReposWithFilters(@Query() pageOptionsDto: RepoSearchOptionsDto): Promise<PageDto<DbRepoWithStats>> {
    return this.repoService.findAllWithFilters(pageOptionsDto);
  }

  @Get("/search/fuzzy")
  @ApiOperation({
    operationId: "findAllReposWithFuzzyFilters",
    summary: "A paginated fuzzy fast finder for repos using repo names and topics - note: does NOT include repo stats",
  })
  @ApiPaginatedResponse(DbRepo)
  @ApiOkResponse({ type: DbRepo })
  @Header("Cache-Control", "public, max-age=600")
  async findAllReposWithFuzzyFilters(@Query() pageOptionsDto: RepoFuzzySearchOptionsDto): Promise<PageDto<DbRepo>> {
    return this.repoService.fastFuzzyFind(pageOptionsDto);
  }
}
