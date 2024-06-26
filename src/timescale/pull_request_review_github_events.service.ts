import { BadRequestException, Inject, Injectable, forwardRef } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, SelectQueryBuilder } from "typeorm";
import { FilterListContributorsDto } from "../user-lists/dtos/filter-contributors.dto";
import { RepoService } from "../repo/repo.service";
import { PullRequestPageOptionsDto } from "../pull-requests/dtos/pull-request-page-options.dto";
import { RepoSearchOptionsDto } from "../repo/dtos/repo-search-options.dto";
import { PageOptionsDto } from "../common/dtos/page-options.dto";
import { PageMetaDto } from "../common/dtos/page-meta.dto";
import { PageDto } from "../common/dtos/page.dto";
import { GetPrevDateISOString } from "../common/util/datetimes";
import { UserListService } from "../user-lists/user-list.service";
import { PullRequestReviewHistogramDto } from "../histogram/dtos/pull_request_review.dto";
import { OrderDirectionEnum } from "../common/constants/order-direction.constant";
import { DbPullRequestReviewGitHubEvents } from "./entities/pull_request_review_github_event.entity";
import { DbPullRequestReviewGitHubEventsHistogram } from "./entities/pull_request_review_github_events_histogram.entity";
import { ContributorStatsTypeEnum } from "./dtos/most-active-contrib.dto";
import { applyContribTypeEnumFilters } from "./common/counts";

/*
 * pull request review events, named "PullRequestReviewEvent" in the GitHub API, are when
 * a GitHub actor makes a pull request review (approving, commenting, requesting changes).
 *
 * for further details, refer to: https://docs.github.com/en/rest/using-the-rest-api/github-event-types?apiVersion=2022-11-28
 */

@Injectable()
export class PullRequestReviewGithubEventsService {
  constructor(
    @InjectRepository(DbPullRequestReviewGitHubEvents, "TimescaleConnection")
    private pullRequestReviewGithubEventsRepository: Repository<DbPullRequestReviewGitHubEvents>,
    @Inject(forwardRef(() => RepoService))
    private readonly repoService: RepoService,
    @Inject(forwardRef(() => UserListService))
    private readonly userListService: UserListService
  ) {}

  baseQueryBuilder() {
    const builder = this.pullRequestReviewGithubEventsRepository.createQueryBuilder(
      "pull_request_review_github_events"
    );

    return builder;
  }

  /*
   * this function takes a cte builder and gets the common rows for pull_request_review_github_events
   * off of it. It also builds a cte counter to ensure metadata is built correctly
   * for the timescale query.
   */
  async execCommonTableExpression(
    pageOptionsDto: PageOptionsDto,
    cteBuilder: SelectQueryBuilder<DbPullRequestReviewGitHubEvents>
  ) {
    const queryBuilder = this.pullRequestReviewGithubEventsRepository.manager
      .createQueryBuilder()
      .addCommonTableExpression(cteBuilder, "CTE")
      .setParameters(cteBuilder.getParameters())
      .select(
        `event_id,
        pr_number,
        pr_state,
        pr_is_draft,
        pr_is_merged,
        pr_mergeable_state,
        pr_is_rebaseable,
        pr_title,
        pr_head_label,
        pr_base_label,
        pr_head_ref,
        pr_base_ref,
        pr_author_login,
        pr_created_at,
        pr_closed_at,
        pr_merged_at,
        pr_updated_at,
        pr_comments,
        pr_additions,
        pr_deletions,
        pr_changed_files,
        repo_name,
        pr_commits,
        pr_review_body`
      )
      .from("CTE", "CTE")
      .where("row_num = 1")
      .offset(pageOptionsDto.skip)
      .limit(pageOptionsDto.limit);

    const cteCounter = this.pullRequestReviewGithubEventsRepository.manager
      .createQueryBuilder()
      .addCommonTableExpression(cteBuilder, "CTE")
      .setParameters(cteBuilder.getParameters())
      .select(`COUNT(*) as count`)
      .from("CTE", "CTE")
      .where("row_num = 1");

    const cteCounterResult = await cteCounter.getRawOne<{ count: number }>();
    const itemCount = parseInt(`${cteCounterResult?.count ?? "0"}`, 10);

    const entities = await queryBuilder.getRawMany<DbPullRequestReviewGitHubEvents>();

    const pageMetaDto = new PageMetaDto({ itemCount, pageOptionsDto });

    return new PageDto(entities, pageMetaDto);
  }

  async getCreatedPullReqReviewEventsForLogin(
    username: string,
    range: number,
    repos?: string[]
  ): Promise<DbPullRequestReviewGitHubEvents[]> {
    const queryBuilder = this.baseQueryBuilder()
      .where("LOWER(actor_login) = :username", { username })
      .andWhere("pr_review_action = 'created'")
      .andWhere("event_time > NOW() - :range_interval::INTERVAL", { range_interval: `${range} days` });

    if (repos && repos.length > 0) {
      queryBuilder.andWhere("LOWER(repo_name) IN (:...repos)", { repos });
    }

    return queryBuilder.getMany();
  }

  async findAllWithFilters(
    pageOptionsDto: PullRequestPageOptionsDto
  ): Promise<PageDto<DbPullRequestReviewGitHubEvents>> {
    const startDate = GetPrevDateISOString(pageOptionsDto.prev_days_start_date);
    const range = pageOptionsDto.range!;
    const order = pageOptionsDto.orderDirection!;

    const cteBuilder = this.pullRequestReviewGithubEventsRepository
      .createQueryBuilder("pull_request_review_github_events")
      .select("*")
      .addSelect(`ROW_NUMBER() OVER (PARTITION BY pr_number, repo_name ORDER BY event_time ${order}) AS row_num`)
      .orderBy("event_time", order);

    cteBuilder
      .where(`:start_date::TIMESTAMP >= "pull_request_review_github_events"."event_time"`, { start_date: startDate })
      .andWhere(
        `:start_date::TIMESTAMP - :range_interval::INTERVAL <= "pull_request_review_github_events"."event_time"`,
        {
          start_date: startDate,
          range_interval: `${range} days`,
        }
      );

    /* filter on PR author / contributor */
    if (pageOptionsDto.contributor) {
      cteBuilder.andWhere(`LOWER("pull_request_review_github_events"."actor_login") = LOWER(:author)`, {
        author: pageOptionsDto.contributor,
      });
    }

    /*
     * apply repo specific filters (topics, top 100, etc.) - this captures a few
     * pre-defined filters provided by the PullRequestPageOptionsDto.
     * This will call out to the API connection to get metadata on the repos.
     */
    if (pageOptionsDto.filter || pageOptionsDto.topic) {
      const filtersDto: RepoSearchOptionsDto = {
        filter: pageOptionsDto.filter,
        topic: pageOptionsDto.topic,
        limit: 50,
        skip: 0,
        range,
      };

      const repos = await this.repoService.findAllWithFilters(filtersDto);
      const repoNames = repos.data.map((repo) => repo.full_name.toLowerCase());

      cteBuilder.andWhere(`LOWER("pull_request_review_github_events"."repo_name") IN (:...repoNames)`, {
        repoNames,
      });
    }

    /* apply user provided repo name filters */
    if (pageOptionsDto.repo) {
      cteBuilder.andWhere(`LOWER("pull_request_review_github_events"."repo_name") IN (:...repoNames)`, {
        repoNames: pageOptionsDto.repo.toLowerCase().split(","),
      });
    }

    /* apply filters for consumer provided repo ids */
    if (pageOptionsDto.repoIds) {
      cteBuilder.andWhere(`"pull_request_review_github_events"."repo_id" IN (:...repoIds)`, {
        repoIds: pageOptionsDto.repoIds.split(","),
      });
    }

    /*
     * filter on a given list ID: this uses the API connection to find the usernames
     * to use for filtering on the timescale data.
     */
    if (pageOptionsDto.listId) {
      const filtersDto: FilterListContributorsDto = {
        skip: 0,
      };

      const users = await this.userListService.findContributorsByListId(filtersDto, pageOptionsDto.listId);
      const userNames = users.data.map((user) => user.username?.toLowerCase());

      cteBuilder.andWhere(`LOWER("pull_request_review_github_events"."pr_author_login") IN (:...userNames)`, {
        userNames,
      });
    }

    /* filter on provided status */
    if (pageOptionsDto.status) {
      cteBuilder.andWhere(`"pull_request_review_github_events"."pr_state" = LOWER(:status)`, {
        status: pageOptionsDto.status,
      });
    }

    return this.execCommonTableExpression(pageOptionsDto, cteBuilder);
  }

  async getPrReviewCountForReviewer(
    username: string,
    contribType: ContributorStatsTypeEnum,
    range: number,
    repos?: string[]
  ): Promise<number> {
    const queryBuilder = this.pullRequestReviewGithubEventsRepository.manager
      .createQueryBuilder()
      .select("COALESCE(COUNT(*), 0) AS prs_reviewed")
      .from("pull_request_review_github_events", "pull_request_review_github_events")
      .where("LOWER(actor_login) = :username", { username })
      .andWhere("pr_review_action = 'created'")
      .groupBy("LOWER(actor_login)");

    if (repos && repos.length > 0) {
      queryBuilder.andWhere(`LOWER(repo_name) IN (:...repos)`, { repos });
    }

    applyContribTypeEnumFilters(contribType, queryBuilder, range);

    const result = await queryBuilder.getRawOne<{ prs_reviewed: number }>();
    const parsedResult = parseFloat(`${result?.prs_reviewed ?? "0"}`);

    return parsedResult;
  }

  async genPrReviewHistogram(
    options: PullRequestReviewHistogramDto
  ): Promise<DbPullRequestReviewGitHubEventsHistogram[]> {
    if (!options.contributor && !options.repo && !options.repoIds) {
      throw new BadRequestException("must provide contributor, repo, or repoIds");
    }

    const { range } = options;
    const order = options.orderDirection ?? OrderDirectionEnum.DESC;
    const startDate = GetPrevDateISOString(options.prev_days_start_date ?? 0);
    const width = options.width ?? 1;

    const queryBuilder = this.pullRequestReviewGithubEventsRepository.manager.createQueryBuilder();

    queryBuilder
      .select("time_bucket(:width_interval::INTERVAL, event_time)", "bucket")
      .addSelect("count(CASE WHEN LOWER(pr_review_action) = 'created' THEN 1 END)", "all_reviews")
      .addSelect(
        "count(CASE WHEN LOWER(pr_review_author_association) = 'contributor' THEN 1 END)",
        "collaborator_associated_reviews"
      )
      .addSelect(
        "count(CASE WHEN LOWER(pr_review_author_association) = 'contributor' THEN 1 END)",
        "contributor_associated_reviews"
      )
      .addSelect(
        "count(CASE WHEN LOWER(pr_review_author_association) = 'member' THEN 1 END)",
        "member_associated_reviews"
      )
      .addSelect("count(CASE WHEN LOWER(pr_review_author_association) = 'none' THEN 1 END)", "non_associated_reviews")
      .addSelect(
        "count(CASE WHEN LOWER(pr_review_author_association) = 'owner' THEN 1 END)",
        "owner_associated_reviews"
      )
      .addSelect("count(CASE WHEN LOWER(pr_review_state) = 'approved' THEN 1 END)", "approved_reviews")
      .addSelect("count(CASE WHEN LOWER(pr_review_state) = 'commented' THEN 1 END)", "commented_reviews")
      .addSelect(
        "count(CASE WHEN LOWER(pr_review_state) = 'changes_requested' THEN 1 END)",
        "changes_requested_reviews"
      )
      .from("pull_request_review_github_events", "pull_request_review_github_events")
      .where(`:start_date::TIMESTAMP >= "pull_request_review_github_events"."event_time"`, { start_date: startDate })
      .andWhere(
        `:start_date::TIMESTAMP - :range_interval::INTERVAL <= "pull_request_review_github_events"."event_time"`,
        {
          start_date: startDate,
          range_interval: `${range} days`,
        }
      )
      .groupBy("bucket")
      .orderBy("bucket", order)
      .setParameter("width_interval", `${width} days`);

    /* filter on the provided pull req review author */
    if (options.contributor) {
      queryBuilder.andWhere(`LOWER("pull_request_review_github_events"."pr_review_author_login") = LOWER(:author)`, {
        author: options.contributor,
      });
    }

    /* apply consumer provided repo name filters */
    if (options.repo) {
      queryBuilder.andWhere(`LOWER("pull_request_review_github_events"."repo_name") IN (:...repoNames)`, {
        repoNames: options.repo.toLowerCase().split(","),
      });
    }

    /* apply filters for consumer provided repo ids */
    if (options.repoIds) {
      queryBuilder.andWhere(`"pull_request_review_github_events"."repo_id" IN (:...repoIds)`, {
        repoIds: options.repoIds.split(","),
      });
    }

    const rawResults = await queryBuilder.getRawMany();

    return rawResults as DbPullRequestReviewGitHubEventsHistogram[];
  }
}
