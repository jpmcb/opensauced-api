import { BadRequestException, Inject, Injectable, NotFoundException, forwardRef } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, SelectQueryBuilder } from "typeorm";
import { PageDto } from "../common/dtos/page.dto";
import { RepoService } from "../repo/repo.service";
import { FilterListContributorsDto } from "../user-lists/dtos/filter-contributors.dto";
import { UserListService } from "../user-lists/user-list.service";
import { IssuePageOptionsDto } from "../pull-requests/dtos/issue-page-options.dto";
import { RepoSearchOptionsDto } from "../repo/dtos/repo-search-options.dto";
import { PageMetaDto } from "../common/dtos/page-meta.dto";
import { PageOptionsDto } from "../common/dtos/page-options.dto";
import { OrderDirectionEnum } from "../common/constants/order-direction.constant";
import { GetPrevDateISOString } from "../common/util/datetimes";
import { IssueHistogramDto } from "../histogram/dtos/issue.dto";
import { ContributorStatsTypeEnum } from "./dtos/most-active-contrib.dto";
import { applyContribTypeEnumFilters } from "./common/counts";
import { DbIssuesGitHubEvents } from "./entities/issues_github_event.entity";
import { DbIssuesGitHubEventsHistogram } from "./entities/issues_github_events_histogram.entity";

/*
 * issue events, named "IssueEvent" in the GitHub API, are when
 * a GitHub actor creates/modifies an issue.
 *
 * IMPORTANT NOTE: issue events in this context are for only repo isues.
 * This may be confusing because "issues" in the context of the GitHub API refer to BOTH pull
 * requests and actual issues. But, issues in this service are for only issues on GitHub repos.
 * For creation / edits
 *
 * for further details, refer to: https://docs.github.com/en/rest/using-the-rest-api/github-event-types?apiVersion=2022-11-28
 */

@Injectable()
export class IssuesGithubEventsService {
  constructor(
    @InjectRepository(DbIssuesGitHubEvents, "TimescaleConnection")
    private issueGitHubEventsRepository: Repository<DbIssuesGitHubEvents>,
    @Inject(forwardRef(() => RepoService))
    private repoService: RepoService,
    @Inject(forwardRef(() => UserListService))
    private userListService: UserListService
  ) {}

  baseQueryBuilder() {
    const builder = this.issueGitHubEventsRepository.createQueryBuilder();

    return builder;
  }

  /*
   * this CTE gets all issues for a given repo in a given time window.
   * the issues are partitioned by the most recent event (since there may be multiple
   * events for any given pr): this way, the most up to date pr events can be used with "row_num = 1"
   */
  baseRepoCteBuilder(repo: string, range: number, prevDays: number) {
    const startDate = GetPrevDateISOString(prevDays);
    const cteBuilder = this.issueGitHubEventsRepository
      .createQueryBuilder("issues_github_events")
      .select("*")
      .addSelect(`ROW_NUMBER() OVER (PARTITION BY issue_number, repo_name ORDER BY event_time DESC) AS row_num`)
      .where(`LOWER("issues_github_events"."repo_name") = LOWER(:repo_name)`, { repo_name: repo.toLowerCase() })
      .andWhere(`:start_date::TIMESTAMP >= "issues_github_events"."event_time"`, { start_date: startDate })
      .andWhere(`:start_date::TIMESTAMP - :range_interval::INTERVAL <= "issues_github_events"."event_time"`, {
        start_date: startDate,
        range_interval: `${range} days`,
      });

    return cteBuilder;
  }

  async findIssueStatsByRepo(
    repo: string,
    range: number,
    prevDaysStartDate: number
  ): Promise<DbIssuesGitHubEventsHistogram> {
    const cteBuilder = this.baseRepoCteBuilder(repo, range, prevDaysStartDate);

    const queryBuilder = this.issueGitHubEventsRepository.manager
      .createQueryBuilder()
      .addCommonTableExpression(cteBuilder, "CTE")
      .setParameters(cteBuilder.getParameters())
      .addSelect("count(*)", "issue_count")
      .addSelect("count(CASE WHEN LOWER(issue_action) = 'opened' THEN 1 END)", "opened_issues")
      .addSelect("count(CASE WHEN LOWER(issue_action) = 'closed' THEN 1 END)", "closed_issues")
      .addSelect(
        `COALESCE(AVG(CASE WHEN issue_state = 'closed' THEN issue_closed_at::DATE - issue_created_at::DATE END), 0)::INTEGER AS issue_velocity`
      )
      .from("CTE", "CTE")
      .where("row_num = 1");

    const result: DbIssuesGitHubEventsHistogram | undefined = await queryBuilder.getRawOne();

    if (!result) {
      throw new NotFoundException();
    }

    return result;
  }

  async getCreatedIssueEventsForLogin(
    username: string,
    range: number,
    repos?: string[]
  ): Promise<DbIssuesGitHubEvents[]> {
    const queryBuilder = this.baseQueryBuilder()
      .where("LOWER(actor_login) = :username", { username })
      .andWhere("issue_action = 'opened'")
      .andWhere("event_time > NOW() - :range_interval::INTERVAL", { range_interval: `${range} days` });

    if (repos && repos.length > 0) {
      queryBuilder.andWhere("LOWER(repo_name) IN (:...repos)", { repos });
    }

    return queryBuilder.getMany();
  }

  async getIssueCountForAuthor(
    username: string,
    contribType: ContributorStatsTypeEnum,
    range: number,
    repos?: string[]
  ): Promise<number> {
    const queryBuilder = this.issueGitHubEventsRepository.manager
      .createQueryBuilder()
      .select("COALESCE(COUNT(*), 0) AS issues_created")
      .from("issues_github_events", "issues_github_events")
      .where("LOWER(actor_login) = :username", { username })
      .andWhere("issue_action = 'opened'")
      .groupBy("LOWER(actor_login)");

    if (repos && repos.length > 0) {
      queryBuilder.andWhere(`LOWER(repo_name) IN (:...repos)`, { repos });
    }

    applyContribTypeEnumFilters(contribType, queryBuilder, range);

    const result = await queryBuilder.getRawOne<{ issues_created: number }>();
    const parsedResult = parseFloat(`${result?.issues_created ?? "0"}`);

    return parsedResult;
  }

  async genIssueHistogram(options: IssueHistogramDto): Promise<DbIssuesGitHubEventsHistogram[]> {
    if (!options.contributor && !options.repo && !options.repoIds) {
      throw new BadRequestException("must provide contributor, repo, or repoIds");
    }

    const { range } = options;
    const order = options.orderDirection ?? OrderDirectionEnum.DESC;
    const startDate = GetPrevDateISOString(options.prev_days_start_date ?? 0);
    const width = options.width ?? 1;

    const queryBuilder = this.issueGitHubEventsRepository.manager
      .createQueryBuilder()
      .select(`time_bucket(:width_interval::INTERVAL, event_time)`, "bucket")
      .addSelect(
        "count(CASE WHEN LOWER(issue_author_association) = 'collaborator' THEN 1 END)",
        "collaborator_associated_issues"
      )
      .addSelect(
        "count(CASE WHEN LOWER(issue_author_association) = 'contributor' THEN 1 END)",
        "contributor_associated_issues"
      )
      .addSelect("count(CASE WHEN LOWER(issue_author_association) = 'member' THEN 1 END)", "member_associated_issues")
      .addSelect("count(CASE WHEN LOWER(issue_author_association) = 'none' THEN 1 END)", "non_associated_issues")
      .addSelect("count(CASE WHEN LOWER(issue_author_association) = 'owner' THEN 1 END)", "owner_associated_issues")
      .addSelect("count(CASE WHEN LOWER(issue_action) = 'opened' THEN 1 END)", "opened_issues")
      .addSelect("count(CASE WHEN LOWER(issue_action) = 'closed' THEN 1 END)", "closed_issues")
      .addSelect("count(CASE WHEN LOWER(issue_action) = 'reopened' THEN 1 END)", "reopened_issues")
      .addSelect("count(CASE WHEN LOWER(issue_active_lock_reason) = 'spam' THEN 1 END)", "spam_issues")
      .addSelect(
        `COALESCE(AVG(CASE WHEN issue_state = 'closed' THEN issue_closed_at::DATE - issue_created_at::DATE END), 0)::INTEGER AS issue_velocity`
      )
      .from("issues_github_events", "issues_github_events")
      .where(`:start_date::TIMESTAMP >= "issues_github_events"."event_time"`, { start_date: startDate })
      .andWhere(`:start_date::TIMESTAMP - :range_interval::INTERVAL <= "issues_github_events"."event_time"`, {
        start_date: startDate,
        range_interval: `${range} days`,
      })
      .groupBy("bucket")
      .orderBy("bucket", order)
      .setParameter("width_interval", `${width} days`);

    /* filter on the provided issue author */
    if (options.contributor) {
      queryBuilder.andWhere(`LOWER("issues_github_events"."issue_author_login") = LOWER(:author)`, {
        author: options.contributor,
      });
    }

    /* filter on the provided repo names */
    if (options.repo) {
      queryBuilder.andWhere(`LOWER("issues_github_events"."repo_name") IN (:...repoNames)`, {
        repoNames: options.repo.toLowerCase().split(","),
      });
    }

    /* filter on the provided repo ids */
    if (options.repoIds) {
      queryBuilder.andWhere(`"issues_github_events"."repo_id" IN (:...repoIds)`, {
        repoIds: options.repoIds.split(","),
      });
    }

    const rawResults = await queryBuilder.getRawMany();

    return rawResults as DbIssuesGitHubEventsHistogram[];
  }

  /*
   * this function takes a cte builder and gets the common rows for issues_github_events
   * off of it. It also builds a cte counter to ensure metadata is built correctly
   * for the timescale query.
   */
  async execCommonTableExpression(
    pageOptionsDto: PageOptionsDto,
    cteBuilder: SelectQueryBuilder<DbIssuesGitHubEvents>
  ) {
    const queryBuilder = this.issueGitHubEventsRepository.manager
      .createQueryBuilder()
      .addCommonTableExpression(cteBuilder, "CTE")
      .setParameters(cteBuilder.getParameters())
      .select(
        `event_id,
        issue_number,
        issue_state,
        issue_title,
        issue_body,
        issue_author_login,
        issue_created_at,
        issue_closed_at,
        issue_updated_at,
        issue_comments,
        repo_name,
        issue_reactions_plus_one,
        issue_reactions_minus_one,
        issue_reactions_laugh,
        issue_reactions_hooray,
        issue_reactions_confused,
        issue_reactions_heart,
        issue_reactions_rocket,
        issue_reactions_eyes
        `
      )
      .from("CTE", "CTE")
      .where("row_num = 1")
      .offset(pageOptionsDto.skip)
      .limit(pageOptionsDto.limit);

    const cteCounter = this.issueGitHubEventsRepository.manager
      .createQueryBuilder()
      .addCommonTableExpression(cteBuilder, "CTE")
      .setParameters(cteBuilder.getParameters())
      .select(`COUNT(*) as count`)
      .from("CTE", "CTE")
      .where("row_num = 1");

    const cteCounterResult = await cteCounter.getRawOne<{ count: number }>();
    const itemCount = parseInt(`${cteCounterResult?.count ?? "0"}`, 10);

    const entities = await queryBuilder.getRawMany<DbIssuesGitHubEvents>();

    const pageMetaDto = new PageMetaDto({ itemCount, pageOptionsDto });

    return new PageDto(entities, pageMetaDto);
  }

  async findAllWithFilters(pageOptionsDto: IssuePageOptionsDto): Promise<PageDto<DbIssuesGitHubEvents>> {
    const startDate = GetPrevDateISOString(pageOptionsDto.prev_days_start_date);
    const range = pageOptionsDto.range!;
    const order = pageOptionsDto.orderDirection!;

    const cteBuilder = this.issueGitHubEventsRepository.createQueryBuilder("issues_github_events").select("*");

    if (pageOptionsDto.distinctAuthors) {
      const distinctAuthors = pageOptionsDto.distinctAuthors === "true" || pageOptionsDto.distinctAuthors === "1";

      if (distinctAuthors) {
        cteBuilder.addSelect(
          `ROW_NUMBER() OVER (PARTITION BY issue_author_login, repo_name ORDER BY event_time ${order}) AS row_num`
        );
      } else {
        cteBuilder.addSelect(
          `ROW_NUMBER() OVER (PARTITION BY issue_number, repo_name ORDER BY event_time ${order}) AS row_num`
        );
      }
    }

    cteBuilder
      .orderBy("event_time", order)
      .where(`:start_date::TIMESTAMP >= "issues_github_events"."event_time"`, { start_date: startDate })
      .andWhere(`:start_date::TIMESTAMP - :range_interval::INTERVAL <= "issues_github_events"."event_time"`, {
        start_date: startDate,
        range_interval: `${range} days`,
      });

    /* filter on PR author / contributor */
    if (pageOptionsDto.contributor) {
      cteBuilder.andWhere(`LOWER("issues_github_events"."issue_author_login") = LOWER(:author)`, {
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

      cteBuilder.andWhere(`LOWER("issues_github_events"."repo_name") IN (:...repoNames)`, {
        repoNames,
      });
    }

    /* apply user provided repo name filters */
    if (pageOptionsDto.repo) {
      cteBuilder.andWhere(`LOWER("issues_github_events"."repo_name") IN (:...repoNames)`, {
        repoNames: pageOptionsDto.repo.toLowerCase().split(","),
      });
    }

    /* apply filters for consumer provided repo ids */
    if (pageOptionsDto.repoIds) {
      cteBuilder.andWhere(`"issues_github_events"."repo_id" IN (:...repoIds)`, {
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

      cteBuilder.andWhere(`LOWER("issues_github_events"."issue_author_login") IN (:...userNames)`, {
        userNames,
      });
    }

    /* filter on provided status */
    if (pageOptionsDto.status) {
      cteBuilder.andWhere(`"issues_github_events"."issue_state" = LOWER(:status)`, {
        status: pageOptionsDto.status,
      });
    }

    return this.execCommonTableExpression(pageOptionsDto, cteBuilder);
  }
}
