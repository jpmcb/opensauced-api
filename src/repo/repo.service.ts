import { BadRequestException, Inject, Injectable, NotFoundException, forwardRef } from "@nestjs/common";
import { ObjectLiteral, Repository, SelectQueryBuilder } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";

import { ConfigService } from "@nestjs/config";
import { Octokit } from "@octokit/rest";
import { DbPushGitHubEvents } from "../timescale/entities/push_github_events.entity";
import { IssuesGithubEventsService } from "../timescale/issues_github_events.service";
import { PageMetaDto } from "../common/dtos/page-meta.dto";
import { PageDto } from "../common/dtos/page.dto";
import { OrderDirectionEnum } from "../common/constants/order-direction.constant";
import { InsightFilterFieldsEnum } from "../insight/dtos/insight-options.dto";
import { RepoFilterService } from "../common/filters/repo-filter.service";
import { PageOptionsDto } from "../common/dtos/page-options.dto";
import { GetPrevDateISOString } from "../common/util/datetimes";
import { PullRequestGithubEventsService } from "../timescale/pull_request_github_events.service";
import { RepoDevstatsService } from "../timescale/repo-devstats.service";
import { UserService } from "../user/services/user.service";
import { ForkGithubEventsService } from "../timescale/fork_github_events.service";
import { PushGithubEventsService } from "../timescale/push_github_events.service";
import { RepoOrderFieldsEnum, RepoPageOptionsDto } from "./dtos/repo-page-options.dto";
import { DbRepo, DbRepoWithStats } from "./entities/repo.entity";
import {
  RepoFuzzySearchOptionsDto,
  RepoRangeOnlyOptionDto,
  RepoRangeOptionsDto,
  RepoSearchOptionsDto,
} from "./dtos/repo-search-options.dto";
import { DbLotteryFactor } from "./entities/lotto.entity";
import { calculateLottoFactor } from "./common/lotto";
import { DbRepoRossIndex } from "./entities/ross.entity";
import { DbRepoYolo } from "./entities/yolo.entity";

@Injectable()
export class RepoService {
  constructor(
    @InjectRepository(DbRepoWithStats, "ApiConnection")
    private repoRepository: Repository<DbRepoWithStats>,
    private filterService: RepoFilterService,
    @Inject(forwardRef(() => PullRequestGithubEventsService))
    private pullRequestGithubEventsService: PullRequestGithubEventsService,
    private forkGithubEventsService: ForkGithubEventsService,
    private pushGithubEventsService: PushGithubEventsService,
    @Inject(forwardRef(() => IssuesGithubEventsService))
    private issueGithubEventsService: IssuesGithubEventsService,
    private repoDevstatsService: RepoDevstatsService,
    private configService: ConfigService,
    private userService: UserService
  ) {}

  subQueryCount<T extends ObjectLiteral>(
    subQuery: SelectQueryBuilder<T>,
    entity: string,
    alias: string,
    target = "repo"
  ) {
    const aliasName = `${alias}Count`;
    const aliasTable = `${alias}CountSelect`;

    return subQuery
      .select("COUNT(DISTINCT id)", aliasName)
      .from(entity, aliasTable)
      .where(`${aliasTable}.${target}_id = ${target}.id`);
  }

  baseQueryBuilder() {
    const builder = this.repoRepository
      .createQueryBuilder("repo")
      .addSelect((qb) => this.subQueryCount(qb, "DbRepoToUserVotes", "votes"), "votesCount")
      .addSelect((qb) => this.subQueryCount(qb, "DbRepoToUserSubmissions", "submissions"), "submissionsCount")
      .addSelect((qb) => this.subQueryCount(qb, "DbRepoToUserStargazers", "stargazers"), "stargazersCount")
      .addSelect((qb) => this.subQueryCount(qb, "DbRepoToUserStars", "stars"), "starsCount")
      .loadRelationCountAndMap("repo.votesCount", "repo.repoToUserVotes")
      .loadRelationCountAndMap("repo.submissionsCount", "repo.repoToUserSubmissions")
      .loadRelationCountAndMap("repo.stargazersCount", "repo.repoToUserStargazers")
      .loadRelationCountAndMap("repo.starsCount", "repo.repoToUserStars");

    return builder;
  }

  private baseFilterQueryBuilder() {
    return this.repoRepository.createQueryBuilder("repos");
  }

  async findOneById(id: number): Promise<DbRepoWithStats> {
    const queryBuilder = this.baseQueryBuilder();

    queryBuilder.where("repo.id = :id", { id });

    const item = await queryBuilder.getOne();

    if (!item) {
      throw new NotFoundException();
    }

    return item;
  }

  async findOneByOwnerAndRepo(owner: string, repo: string, range = 30, minimalInfo = false): Promise<DbRepoWithStats> {
    const queryBuilder = this.baseQueryBuilder();

    queryBuilder.where("LOWER(repo.full_name) = :name", { name: `${owner}/${repo}`.toLowerCase() });

    const item = await queryBuilder.getOne();

    if (!item) {
      throw new NotFoundException(`Repository not found: ${owner}/${repo}`);
    }

    if (minimalInfo) {
      return item;
    }

    const prStats = await this.pullRequestGithubEventsService.findPrStatsByRepo(item.full_name, range, 0);

    const forksHisto = await this.forkGithubEventsService.genForkHistogram({ repo: item.full_name, range });
    const forksVelocity = forksHisto.reduce((acc, curr) => acc + curr.forks_count, 0) / (range || 30);
    const activityRatio = await this.repoDevstatsService.calculateRepoActivityRatio(item.full_name, range);
    const confidence = await this.repoDevstatsService.calculateContributorConfidenceByRepoName(item.full_name, range);
    const pushDates = await this.pushGithubEventsService.lastPushDatesForRepo(item.full_name);

    // get issue stats for each repo found through filtering
    const issuesStats = await this.issueGithubEventsService.findIssueStatsByRepo(item.full_name, range, 0);

    return {
      ...item,
      opened_issues_count: issuesStats.opened_issues,
      closed_issues_count: issuesStats.closed_issues,
      issues_velocity_count: issuesStats.issue_velocity,
      open_prs_count: prStats.open_prs,
      pr_active_count: prStats.active_prs,
      merged_prs_count: prStats.accepted_prs,
      spam_prs_count: prStats.spam_prs,
      draft_prs_count: prStats.draft_prs,
      closed_prs_count: prStats.closed_prs,
      pr_velocity_count: prStats.pr_velocity,
      fork_velocity: forksVelocity,
      activity_ratio: activityRatio,
      contributor_confidence: confidence,
      health: activityRatio,
      last_pushed_at: pushDates.push_date,
      last_main_pushed_at: pushDates.main_push_date,
    } as unknown as DbRepoWithStats;
  }

  async findAll(
    pageOptionsDto: RepoPageOptionsDto,
    userId?: number,
    userRelations?: string[]
  ): Promise<PageDto<DbRepoWithStats>> {
    const queryBuilder = this.baseQueryBuilder();
    const orderField = pageOptionsDto.orderBy ?? RepoOrderFieldsEnum.pushed_at;

    if (userId) {
      userRelations?.map((relation) =>
        queryBuilder.innerJoin(
          `repo.repoToUser${relation}`,
          `authUser${relation}`,
          `authUser${relation}.user_id = :userId`,
          { userId }
        )
      );
    }

    queryBuilder
      .orderBy(`"repo"."is_fork"`, OrderDirectionEnum.ASC)
      .addOrderBy(`"${orderField}"`, pageOptionsDto.orderDirection)
      .addOrderBy(`"repo"."created_at"`, OrderDirectionEnum.DESC)
      .offset(pageOptionsDto.skip)
      .limit(pageOptionsDto.limit);

    const itemCount = await queryBuilder.getCount();
    const entities = await queryBuilder.getMany();

    const pageMetaDto = new PageMetaDto({ itemCount, pageOptionsDto });

    return new PageDto(entities, pageMetaDto);
  }

  private async findAllWithFiltersScaffolding(
    pageOptionsDto: RepoSearchOptionsDto,
    workspaceId: string | undefined
  ): Promise<PageDto<DbRepoWithStats>> {
    const orderField = pageOptionsDto.orderBy ?? RepoOrderFieldsEnum.pushed_at;
    const startDate = GetPrevDateISOString(pageOptionsDto.prev_days_start_date);
    const prevDaysStartDate = pageOptionsDto.prev_days_start_date!;
    const range = pageOptionsDto.range!;

    if ((range === 180 || range === 360) && !pageOptionsDto.repoIds && !pageOptionsDto.repo) {
      throw new BadRequestException("ranges of 180 and 360 days not supported without repo ID or repo name");
    }

    const queryBuilder = this.baseFilterQueryBuilder().withDeleted().addSelect("repos.deleted_at");

    const filters = this.filterService.getRepoFilters(pageOptionsDto);

    if (!pageOptionsDto.repoIds && !pageOptionsDto.repo && !workspaceId) {
      filters.push([`:start_date::TIMESTAMP >= "repos"."updated_at"`, { start_date: startDate }]);
      filters.push([
        `:start_date::TIMESTAMP - :range_interval::INTERVAL <= "repos"."updated_at"`,
        { start_date: startDate, range_interval: `${range} days` },
      ]);
    }

    this.filterService.applyQueryBuilderFilters(queryBuilder, filters);

    if (workspaceId) {
      queryBuilder
        .innerJoin("workspace_repos", "workspace_repos", "workspace_repos.repo_id = repos.id")
        .andWhere("workspace_repos.workspace_id = :workspaceId", { workspaceId });
    }

    if (pageOptionsDto.filter === InsightFilterFieldsEnum.Recent) {
      queryBuilder.orderBy(`"repos"."updated_at"`, "DESC");
    } else {
      queryBuilder.orderBy(`"repos"."pushed_at"`, "DESC");
    }

    const cteCounter = this.repoRepository.manager
      .createQueryBuilder()
      .addCommonTableExpression(queryBuilder, "CTE")
      .setParameters(queryBuilder.getParameters())
      .select(`COUNT(*) as count`)
      .from("CTE", "CTE");

    const countQueryResult = await cteCounter.getRawOne<{ count: number }>();
    const itemCount = parseInt(`${countQueryResult?.count ?? "0"}`, 10);

    queryBuilder
      .addOrderBy(`"repos"."${orderField}"`, OrderDirectionEnum.DESC)
      .offset(pageOptionsDto.skip)
      .limit(pageOptionsDto.limit);

    const entities = await queryBuilder.getMany();
    const pageMetaDto = new PageMetaDto({ itemCount, pageOptionsDto });

    // get PR stats for each repo found through filtering
    const promises = entities.map(async (entity) => {
      const prStats = await this.pullRequestGithubEventsService.findPrStatsByRepo(
        entity.full_name,
        range,
        prevDaysStartDate
      );

      const forksHisto = await this.forkGithubEventsService.genForkHistogram({ repo: entity.full_name, range });
      const forksVelocity = forksHisto.reduce((acc, curr) => acc + curr.forks_count, 0) / range;
      const activityRatio = await this.repoDevstatsService.calculateRepoActivityRatio(entity.full_name, range);
      const confidence = await this.repoDevstatsService.calculateContributorConfidenceByRepoName(
        entity.full_name,
        range
      );
      const pushDates = await this.pushGithubEventsService.lastPushDatesForRepo(entity.full_name);

      return {
        ...entity,
        pr_active_count: prStats.active_prs,
        open_prs_count: prStats.open_prs,
        merged_prs_count: prStats.accepted_prs,
        spam_prs_count: prStats.spam_prs,
        draft_prs_count: prStats.draft_prs,
        closed_prs_count: prStats.closed_prs,
        pr_velocity_count: prStats.pr_velocity,
        fork_velocity: forksVelocity,
        activity_ratio: activityRatio,
        contributor_confidence: confidence,
        health: activityRatio,
        last_pushed_at: pushDates.push_date,
        last_main_pushed_at: pushDates.main_push_date,
      } as DbRepoWithStats;
    });

    const updatedEntities = await Promise.all(promises);

    return new PageDto(updatedEntities, pageMetaDto);
  }

  async fastFuzzyFind(pageOptionsDto: RepoFuzzySearchOptionsDto): Promise<PageDto<DbRepo>> {
    const orderField = pageOptionsDto.orderBy ?? RepoOrderFieldsEnum.pushed_at;
    const queryBuilder = this.baseFilterQueryBuilder()
      .withDeleted()
      .addSelect("repos.deleted_at")
      .where(`full_name ILIKE :fuzzy_search_param`, {
        fuzzy_search_param: `%${pageOptionsDto.fuzzy_repo_name}%`,
      })
      .orderBy(`"repos"."${orderField}"`, OrderDirectionEnum.DESC)
      .offset(pageOptionsDto.skip)
      .limit(pageOptionsDto.limit);

    if (pageOptionsDto.topic) {
      queryBuilder.andWhere(`:topic = ANY(topics)`, { topic: pageOptionsDto.topic });
    }

    const itemCount = await queryBuilder.getCount();
    const entities = await queryBuilder.getMany();

    const pageMetaDto = new PageMetaDto({ itemCount, pageOptionsDto });

    return new PageDto(entities, pageMetaDto);
  }

  async findLottoFactor(pageOptionsDto: RepoRangeOptionsDto): Promise<DbLotteryFactor> {
    const range = pageOptionsDto.range!;
    const repos = pageOptionsDto.repos.split(",");
    const repoInfos = repos.map(async (repo) => {
      const [repoOwner, repoName] = repo.split("/");

      return this.tryFindRepoOrMakeStub({ repoOwner, repoName });
    });

    const reposResolved = await Promise.all(repoInfos);
    const resolvedRepoNames = reposResolved.map((repo) => repo.full_name.toLowerCase());

    // finding the oldest 'created_at' date for the given repos
    const endOfGracePeriod = reposResolved.reduce(
      (oldest, current) => (oldest < current.created_at! ? oldest : current.created_at!),
      reposResolved[0].created_at!
    );

    /*
     * the lottery factor grace period is the oldest created repo plus a month of
     * time to allow for some wiggle room for newly created projects.
     */
    endOfGracePeriod.setDate(endOfGracePeriod.getDate() + 30);

    if (resolvedRepoNames.length === 0) {
      return new DbLotteryFactor();
    }

    const contribCounts = await this.pullRequestGithubEventsService.findAllPrAuthorCounts({
      range,
      prevDaysStartDate: pageOptionsDto.prev_days_start_date ?? 0,
      repoNames: resolvedRepoNames,
      noBots: true,
    });

    return calculateLottoFactor(contribCounts, endOfGracePeriod);
  }

  async findRossIndex(owner: string, name: string, options: RepoRangeOnlyOptionDto): Promise<DbRepoRossIndex> {
    const range = options.range!;
    const repo = await this.findOneByOwnerAndRepo(owner, name, range, true);

    const result = new DbRepoRossIndex();

    const rossIndex = await this.pullRequestGithubEventsService.findRossIndexByRepos([repo.full_name], range);
    const rossContributors = await this.pullRequestGithubEventsService.findRossContributorsByRepos(
      [repo.full_name],
      range
    );

    result.ross = rossIndex;
    result.contributors = rossContributors;

    return result;
  }

  async findYoloPushes(owner: string, name: string, options: RepoRangeOnlyOptionDto): Promise<DbRepoYolo> {
    const range = options.range!;
    const repo = await this.findOneByOwnerAndRepo(owner, name, range, true);
    const defaultRef = `refs/heads/${repo.default_branch}`;

    // create empty result to propagate
    const result = new DbRepoYolo();

    result.num_yolo_pushes = 0;
    result.num_yolo_pushed_commits = 0;
    result.data = [];

    // fetch pushes and pull requests for repo in time range
    const pushes = await this.pushGithubEventsService.getPushEventsAllForRepos({
      range,
      repos: [repo.full_name],
      ref: defaultRef,
    });
    const prs = await this.pullRequestGithubEventsService.findAllMergedByRefRepo(
      repo.full_name,
      range,
      repo.default_branch
    );

    /*
     * create a fast access set of shas that are correlated to the merge
     * commit of a pull request. I.e., we can use this to confirm if the pushed
     * sha at the tip of the ref head when pushed is correlated to a PR in O(1) time.
     *
     * Example:
     *
     * {
     *   abc123,
     *   xyz789,
     *   jkl345,
     * }
     *
     * and when inspecting a push event with ref commit of "xyz789",
     * we can be assured that this push was correlated to a pull request
     * since it exists in the prShaSet of known merge commits in PRs.
     */

    const prShaSet = new Set(prs.map((pr) => pr.pr_merge_commit_sha));

    /*
     * this sha mapping is built up of GitHub push events that are NOT correlated
     * to a known PR merge sha. I.e., these are the yolo pushes.
     */

    const shaMap: Record<string, DbPushGitHubEvents> = {};

    pushes.forEach((push) => {
      /*
       * filter for yolo pushes to the default branch
       * and that do not exist in the pr sha set.
       */
      if (push.push_ref === defaultRef && !prShaSet.has(push.push_head_sha)) {
        shaMap[push.push_head_sha] = push;
      }
    });

    // convert shaMap to result format
    Object.values(shaMap).forEach((push) => {
      result.num_yolo_pushes++;
      result.num_yolo_pushed_commits += push.push_num_commits ?? 0;

      result.data.push({
        actor_login: push.actor_login,
        event_time: push.event_time,
        sha: push.push_head_sha,
        push_num_commits: push.push_num_commits ?? 0,
      });
    });

    return result;
  }

  async findAllWithFilters(pageOptionsDto: RepoSearchOptionsDto): Promise<PageDto<DbRepoWithStats>> {
    return this.findAllWithFiltersScaffolding(pageOptionsDto, undefined);
  }

  async findAllWithFiltersInWorkspace(
    pageOptionsDto: RepoSearchOptionsDto,
    workspaceId: string
  ): Promise<PageDto<DbRepoWithStats>> {
    return this.findAllWithFiltersScaffolding(pageOptionsDto, workspaceId);
  }

  async findRecommendations(interests: string[]): Promise<Record<string, DbRepoWithStats[]>> {
    const queryBuilder = this.repoRepository.createQueryBuilder("repo");
    const userInterests: Record<string, DbRepoWithStats[]> = {};

    const promises = interests.map(async (interest) => {
      queryBuilder
        .where(`(:topic = ANY("repo"."topics"))`, { topic: interest })
        .orderBy(`"repo"."updated_at"`, "DESC")
        .limit(3);

      return queryBuilder.getMany();
    });

    const results = await Promise.all(promises);

    interests.forEach((interest, index) => {
      userInterests[interest] = results[index];
    });

    return userInterests;
  }

  async findOrgsRecommendations(userId: number, pageOptionsDto: PageOptionsDto) {
    const queryBuilder = this.baseFilterQueryBuilder();
    const startDate = GetPrevDateISOString(pageOptionsDto.prev_days_start_date);
    const range = pageOptionsDto.range!;

    queryBuilder
      .leftJoin(
        (qb: SelectQueryBuilder<DbRepoWithStats>) =>
          qb
            .select("users.id", "id")
            .addSelect("users.login", "login")
            .addSelect("user_orgs.user_id", "user_id")
            .from("user_organizations", "user_orgs")
            .innerJoin("users", "users", "user_orgs.organization_id = users.id"),
        "user_orgs",
        "repos.full_name LIKE user_orgs.login || '/%'"
      )
      .where("user_orgs.user_id = :userId", { userId })
      .andWhere(`:start_date::TIMESTAMP >= "repos"."updated_at"`, { start_date: startDate })
      .andWhere(`:start_date::TIMESTAMP - :range_interval::INTERVAL <= "repos"."updated_at"`, {
        start_date: startDate,
        range_interval: `${range} days`,
      })
      .orderBy("repos.pushed_at", pageOptionsDto.orderDirection)
      .addOrderBy("repos.updated_at", pageOptionsDto.orderDirection);

    queryBuilder.offset(pageOptionsDto.skip).limit(pageOptionsDto.limit);

    const entities = await queryBuilder.getMany();
    const itemCount = await queryBuilder.getCount();

    const pageMetaDto = new PageMetaDto({ itemCount, pageOptionsDto });

    return new PageDto(entities, pageMetaDto);
  }

  async tryFindRepoOrMakeStub({
    repoId,
    repoOwner,
    repoName,
    minimalInfo = false,
    rangeOption,
  }: {
    repoId?: number;
    repoOwner?: string;
    repoName?: string;
    minimalInfo?: boolean;
    rangeOption?: RepoRangeOnlyOptionDto;
  }): Promise<DbRepoWithStats> {
    if (!repoId && (!repoOwner || !repoName)) {
      throw new BadRequestException("must provide repo ID or repo owner/name");
    }

    let repo;
    const range = rangeOption?.range ?? 30;

    try {
      if (repoId) {
        repo = await this.findOneById(repoId);
      } else if (repoOwner && repoName) {
        repo = await this.findOneByOwnerAndRepo(repoOwner, repoName, range, minimalInfo);
      }
    } catch (e) {
      // could not find repo being added to workspace in our database. Add it.
      if (repoId && !repoOwner && !repoName) {
        throw new BadRequestException(
          `no repo by repo ID ${repoId} found in DB: must also provide repo owner/name to create stub user from GitHub`
        );
      } else if (repoOwner && repoName) {
        repo = await this.createStubRepo(repoOwner, repoName);
      }
    }

    if (!repo) {
      throw new NotFoundException("could not find nor create repo");
    }

    return repo;
  }

  private async createStubRepo(owner: string, repo: string): Promise<DbRepoWithStats> {
    const ghAuthToken: string = this.configService.get("github.authToken")!;

    // using octokit and GitHub's API, go fetch the user
    const octokit = new Octokit({
      auth: ghAuthToken,
    });

    let octoResponse;

    try {
      octoResponse = await octokit.repos.get({
        owner,
        repo,
      });
    } catch (error: unknown) {
      console.error(error);
      if (error instanceof Error) {
        throw new BadRequestException("Error fetching repo:", `${owner}/${repo} - ${error.message}`);
      } else {
        throw new BadRequestException("Error fetching repo:", `${owner}/${repo} - Unknown error`);
      }
    }

    const parts = octoResponse.data.full_name.split("/");

    if (parts.length !== 2) {
      throw new NotFoundException("");
    }

    /*
     * because there is a reference to the "user" (the owner) of a repo
     * in the repos table, we need to ensure we find or create the user
     */
    const user = await this.userService.tryFindUserOrMakeStub({ username: parts[0] });

    /*
     * create a new, minimum, partial repo based on GitHub data (primarily, the ID).
     * Because our first party databases for repos uses the GitHub IDs as primary keys,
     * we can't use an auto generated ID for a stub repo.
     *
     * This stub repo will eventually get picked up by the ETL and more data will get backfilled.
     */

    return this.repoRepository.save({
      id: octoResponse.data.id,
      user_id: user.id,
      size: octoResponse.data.size,
      issues: octoResponse.data.open_issues_count,
      stars: octoResponse.data.stargazers_count,
      forks: octoResponse.data.forks_count,
      watchers: octoResponse.data.watchers_count,
      subscribers: octoResponse.data.subscribers_count,
      network: octoResponse.data.network_count,
      is_fork: octoResponse.data.fork,
      is_private: octoResponse.data.private,
      is_template: octoResponse.data.is_template,
      is_archived: octoResponse.data.archived,
      is_disabled: octoResponse.data.disabled,
      has_issues: octoResponse.data.has_issues,
      has_projects: octoResponse.data.has_projects,
      has_downloads: octoResponse.data.has_downloads,
      has_wiki: octoResponse.data.has_wiki,
      has_pages: octoResponse.data.has_pages,
      has_discussions: octoResponse.data.has_discussions,
      created_at: octoResponse.data.created_at,
      updated_at: octoResponse.data.updated_at,
      pushed_at: octoResponse.data.pushed_at,
      default_branch: octoResponse.data.default_branch,
      node_id: octoResponse.data.node_id,
      git_url: octoResponse.data.git_url,
      ssh_url: octoResponse.data.ssh_url,
      clone_url: octoResponse.data.clone_url,
      svn_url: octoResponse.data.svn_url,
      name: octoResponse.data.name,
      full_name: octoResponse.data.full_name,
      url: octoResponse.data.url,
      topics: octoResponse.data.topics,
      mirror_url: octoResponse.data.mirror_url ?? "",
      description: octoResponse.data.description ?? "",
      language: octoResponse.data.language ?? "",
      homepage: octoResponse.data.homepage ?? "",
      license: octoResponse.data.license?.name ?? "",
    });
  }
}
