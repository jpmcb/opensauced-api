import { Injectable } from "@nestjs/common";
import { Repository, SelectQueryBuilder } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";

import { orderDbContributorStats } from "../timescale/common/most-active-contributors";
import { PageDto } from "../common/dtos/page.dto";
import { DbPullRequestGitHubEvents } from "../timescale/entities/pull_request_github_event.entity";
import { DbContributorStat } from "../timescale/entities/contributor_devstat.entity";
import { ContributionsPageDto } from "../timescale/dtos/contrib-page.dto";
import { ContributionPageMetaDto } from "../timescale/dtos/contrib-page-meta.dto";
import { ContributorDevstatsService } from "../timescale/contrib-stats.service";
import { ContributorStatsTypeEnum, MostActiveContributorsDto } from "../timescale/dtos/most-active-contrib.dto";
import { PullRequestGithubEventsService } from "../timescale/pull_request_github_events.service";
import { DbUserListContributor } from "./entities/user-list-contributor.entity";
import { ContributionsTimeframeDto } from "./dtos/contributions-timeframe.dto";
import { DbContributionStatTimeframe } from "./entities/contributions-timeframe.entity";
import { ContributionsByProjectDto } from "./dtos/contributions-by-project.dto";
import { DbContributionsProjects } from "./entities/contributions-projects.entity";
import { TopProjectsDto } from "./dtos/top-projects.dto";
import { DbContributorCategoryTimeframe } from "./entities/contributors-timeframe.entity";

@Injectable()
export class UserListEventsStatsService {
  constructor(
    @InjectRepository(DbPullRequestGitHubEvents, "TimescaleConnection")
    private pullRequestGithubEventsRepository: Repository<DbPullRequestGitHubEvents>,
    @InjectRepository(DbUserListContributor, "ApiConnection")
    private userListContributorRepository: Repository<DbUserListContributor>,
    private contributorDevstatsService: ContributorDevstatsService,
    private pullRequestGithubEventsService: PullRequestGithubEventsService
  ) {}

  baseQueryBuilder(): SelectQueryBuilder<DbPullRequestGitHubEvents> {
    const builder = this.pullRequestGithubEventsRepository.createQueryBuilder();

    return builder;
  }

  private userListUsersQueryBuilder(): SelectQueryBuilder<DbUserListContributor> {
    const builder = this.userListContributorRepository.createQueryBuilder("user_list_contributors");

    return builder;
  }

  async findContributorsByType(
    listId: string,
    range: number,
    type: ContributorStatsTypeEnum = ContributorStatsTypeEnum.all,
    repos?: string[]
  ): Promise<string[]> {
    const now = new Date().toISOString();

    const userListUsersBuilder = this.userListUsersQueryBuilder();

    userListUsersBuilder
      .leftJoin("users", "users", "user_list_contributors.user_id=users.id")
      .where("user_list_contributors.list_id = :listId", { listId });

    const allUsers = await userListUsersBuilder.getMany();

    if (allUsers.length === 0) {
      return [];
    }

    const users = allUsers
      .map((user) => (user.username ? user.username.toLowerCase() : ""))
      .filter((user) => user !== "");

    if (users.length === 0) {
      return [];
    }

    const userListQueryBuilder =
      this.pullRequestGithubEventsRepository.manager.createQueryBuilder() as SelectQueryBuilder<DbPullRequestGitHubEvents>;

    userListQueryBuilder.select("DISTINCT users.login", "login");

    userListQueryBuilder.from((qb: SelectQueryBuilder<DbPullRequestGitHubEvents>) => {
      qb.select("LOWER(actor_login)", "login")
        .distinct()
        .from("pull_request_github_events", "pull_request_github_events")
        .where("LOWER(actor_login) IN (:...users)", { users });

      if (repos && repos.length > 0) {
        qb.andWhere("LOWER(repo_name) IN (:...repos)", { repos });
      }

      return qb;
    }, "users");

    switch (type) {
      case ContributorStatsTypeEnum.all:
        break;

      case ContributorStatsTypeEnum.active:
        this.pullRequestGithubEventsService.applyActiveContributorsFilter(userListQueryBuilder, "", now, range);
        break;

      case ContributorStatsTypeEnum.new:
        this.pullRequestGithubEventsService.applyNewContributorsFilter(userListQueryBuilder, "", now, range);
        break;

      case ContributorStatsTypeEnum.alumni: {
        this.pullRequestGithubEventsService.applyAlumniContributorsFilter(userListQueryBuilder, "", now, range);
        break;
      }

      default:
        break;
    }

    const entityQb = this.pullRequestGithubEventsRepository.manager
      .createQueryBuilder()
      .addCommonTableExpression(userListQueryBuilder, "CTE")
      .setParameters(userListQueryBuilder.getParameters())
      .select("login")
      .from("CTE", "CTE");

    const entities = await entityQb.getRawMany<{ login: string }>();

    return entities.map((result) => result.login);
  }

  async findAllListContributorStats(
    pageOptionsDto: MostActiveContributorsDto,
    listId: string
  ): Promise<PageDto<DbContributorStat>> {
    const userListUsersBuilder = this.userListUsersQueryBuilder();

    userListUsersBuilder
      .leftJoin("users", "users", "user_list_contributors.user_id=users.id")
      .where("user_list_contributors.list_id = :listId", { listId });

    const users = await userListUsersBuilder.getMany();

    if (users.length === 0) {
      return new ContributionsPageDto(
        new Array<DbContributorStat>(),
        new ContributionPageMetaDto({ itemCount: 0, pageOptionsDto }, 0)
      );
    }

    /*
     * ignores 2 usernames that cause problems when crunching this data:
     *
     * 1. Usernames that somehow are an empty string. This shouldn't happen
     *    since a username is more or less a required field in the users table.
     *    but we have seen this from time to time which can cause problems trying
     *    to crunch timescale data on all an empty username
     *
     * 2. Ignores bot accounts: many bot accounts make an astronomical number of
     *    commits / comments / reviews etc. etc. And attempting to crunch all that data
     *    for the bot accounts won't work and would require massive resources.
     */
    const filteredUsers = users
      .map((user) => (user.username ? user.username.toLowerCase() : ""))
      .filter((user) => user !== "" && !user.endsWith("[bot]"));

    if (filteredUsers.length === 0) {
      return new ContributionsPageDto(
        new Array<DbContributorStat>(),
        new ContributionPageMetaDto({ itemCount: 0, pageOptionsDto }, 0)
      );
    }

    const userStats = await this.contributorDevstatsService.findAllContributorStats(pageOptionsDto, filteredUsers);

    orderDbContributorStats(pageOptionsDto, userStats);

    const { skip } = pageOptionsDto;
    const limit = pageOptionsDto.limit!;
    const slicedUserStats = userStats.slice(skip, skip + limit);

    let totalCount = 0;

    userStats.forEach((entity) => {
      totalCount += entity.total_contributions;
    });

    const pageMetaDto = new ContributionPageMetaDto({ itemCount: userStats.length, pageOptionsDto }, totalCount);

    return new ContributionsPageDto(slicedUserStats, pageMetaDto);
  }

  async findContributionsInTimeFrame(
    options: ContributionsTimeframeDto,
    listId: string
  ): Promise<DbContributionStatTimeframe[]> {
    const range = options.range!;
    const contribType = options.contributorType;
    const repos = options.repos ? options.repos.toLowerCase().split(",") : undefined;

    const allUsers = await this.findContributorsByType(listId, range, contribType, repos);

    if (allUsers.length === 0) {
      return [];
    }

    const stats = await this.contributorDevstatsService.findAllContributionsByTimeframe(options, allUsers);

    return stats.sort((a, b) => new Date(b.bucket).getTime() - new Date(a.bucket).getTime());
  }

  async findContributionsByProject(
    options: ContributionsByProjectDto,
    listId: string
  ): Promise<DbContributionsProjects[]> {
    const userListUsersBuilder = this.userListUsersQueryBuilder();

    userListUsersBuilder
      .leftJoin("users", "users", "user_list_contributors.user_id=users.id")
      .where("user_list_contributors.list_id = :listId", { listId });

    const users = await userListUsersBuilder.getMany();

    if (users.length === 0) {
      return [];
    }

    /*
     * ignore both users who have a missing username for some reason
     * and bot users. This helps prevent extremely long running queries in the
     * database
     */
    const filteredUsers = users
      .map((user) => (user.username ? user.username.toLowerCase() : ""))
      .filter((user) => user !== "" && !user.endsWith("[bot]"));

    if (filteredUsers.length === 0) {
      return [];
    }

    return this.contributorDevstatsService.findAllContributionsByProject(options, filteredUsers);
  }

  async findTopContributorsByProject(options: TopProjectsDto, listId: string): Promise<DbContributorStat[]> {
    const range = options.range!;
    const repos = options.repos ? options.repos.toLowerCase().split(",") : undefined;

    const allUsers = await this.findContributorsByType(listId, range, undefined, repos);

    if (allUsers.length === 0) {
      return [];
    }

    return this.contributorDevstatsService.findAllContributorStats(
      {
        ...options,
        skip: 0,
      },
      allUsers
    );
  }

  async findContributorCategoriesByTimeframe(
    options: ContributionsTimeframeDto,
    listId: string
  ): Promise<DbContributorCategoryTimeframe[]> {
    const range = options.range!;
    const repos = options.repos ? options.repos.toLowerCase().split(",") : undefined;

    const allUsers = await this.findContributorsByType(listId, range, ContributorStatsTypeEnum.all, repos);

    if (allUsers.length === 0) {
      return [];
    }

    const activeUsers = await this.findContributorsByType(listId, range, ContributorStatsTypeEnum.active, repos);
    const newUsers = await this.findContributorsByType(listId, range, ContributorStatsTypeEnum.new, repos);
    const alumniUsers = await this.findContributorsByType(listId, range, ContributorStatsTypeEnum.alumni, repos);

    /*
     * it's possible that one of the filtered lists will have no returned users:
     * to guard against doing a blank WHERE IN() statment (which is not valid),
     * we add an empty username which selects for no users.
     */

    activeUsers.push("");
    newUsers.push("");
    alumniUsers.push("");

    /*
     * in order to get a sub-table that "time_bucket" can accumulate data from,
     * these large union queries denote a "contributor_category" for each of the user types
     * across many different event tables.
     *
     * there are 2 different queries, one that captures "where repo_names = repos"
     * and the other without. With large, raw queries, TypeORM does not have a great
     * mechanism to parameterize an empty repos list.
     */

    const cteQueryNoRepos = `
      SELECT event_time, 'all_users' as contributor_category
      FROM push_github_events
      WHERE LOWER(actor_login) IN (:...all_users)
      AND push_ref IN('refs/heads/main', 'refs/heads/master')
      AND now() - :range_interval::INTERVAL <= event_time

      UNION ALL

      SELECT event_time, 'active_users' as contributor_category
      FROM push_github_events
      WHERE LOWER(actor_login) IN (:...active_users)
      AND push_ref IN('refs/heads/main', 'refs/heads/master')
      AND now() - :range_interval::INTERVAL <= event_time

      UNION ALL

      SELECT event_time, 'new_users' as contributor_category
      FROM push_github_events
      WHERE LOWER(actor_login) IN (:...new_users)
      AND push_ref IN('refs/heads/main', 'refs/heads/master')
      AND now() - :range_interval::INTERVAL <= event_time

      UNION ALL

      SELECT event_time, 'alumni_users' as contributor_category
      FROM push_github_events
      WHERE LOWER(actor_login) IN (:...alumni_users)
      AND push_ref IN('refs/heads/main', 'refs/heads/master')
      AND now() - :range_interval::INTERVAL <= event_time

      UNION ALL

      SELECT event_time, 'all_users' as contributor_category
      FROM pull_request_github_events
      WHERE LOWER(actor_login) IN (:...all_users)
      AND pr_action='opened'
      AND now() - :range_interval::INTERVAL <= event_time

      UNION ALL

      SELECT event_time, 'active_users' as contributor_category
      FROM pull_request_github_events
      WHERE LOWER(actor_login) IN (:...active_users)
      AND pr_action='opened'
      AND now() - :range_interval::INTERVAL <= event_time

      UNION ALL

      SELECT event_time, 'new_users' as contributor_category
      FROM pull_request_github_events
      WHERE LOWER(actor_login) IN (:...new_users)
      AND pr_action='opened'
      AND now() - :range_interval::INTERVAL <= event_time

      UNION ALL

      SELECT event_time, 'alumni_users' as contributor_category
      FROM pull_request_github_events
      WHERE LOWER(actor_login) IN (:...alumni_users)
      AND pr_action='opened'
      AND now() - :range_interval::INTERVAL <= event_time

      UNION ALL

      SELECT event_time, 'all_users' as contributor_category
      FROM pull_request_review_github_events
      WHERE LOWER(actor_login) IN (:...all_users)
      AND pr_review_action='created'
      AND now() - :range_interval::INTERVAL <= event_time

      UNION ALL

      SELECT event_time, 'active_users' as contributor_category
      FROM pull_request_review_github_events
      WHERE LOWER(actor_login) IN (:...active_users)
      AND pr_review_action='created'
      AND now() - :range_interval::INTERVAL <= event_time

      UNION ALL

      SELECT event_time, 'new_users' as contributor_category
      FROM pull_request_review_github_events
      WHERE LOWER(actor_login) IN (:...new_users)
      AND pr_review_action='created'
      AND now() - :range_interval::INTERVAL <= event_time

      UNION ALL

      SELECT event_time, 'alumni_users' as contributor_category
      FROM pull_request_review_github_events
      WHERE LOWER(actor_login) IN (:...alumni_users)
      AND pr_review_action='created'
      AND now() - :range_interval::INTERVAL <= event_time

      UNION ALL

      SELECT event_time, 'all_users' as contributor_category
      FROM issues_github_events
      WHERE LOWER(actor_login) IN (:...all_users)
      AND issue_action='opened'
      AND now() - :range_interval::INTERVAL <= event_time

      UNION ALL

      SELECT event_time, 'active_users' as contributor_category
      FROM issues_github_events
      WHERE LOWER(actor_login) IN (:...active_users)
      AND issue_action='opened'
      AND now() - :range_interval::INTERVAL <= event_time

      UNION ALL

      SELECT event_time, 'new_users' as contributor_category
      FROM issues_github_events
      WHERE LOWER(actor_login) IN (:...new_users)
      AND issue_action='opened'
      AND now() - :range_interval::INTERVAL <= event_time

      UNION ALL

      SELECT event_time, 'alumni_users' as contributor_category
      FROM issues_github_events
      WHERE LOWER(actor_login) IN (:...alumni_users)
      AND issue_action='opened'
      AND now() - :range_interval::INTERVAL <= event_time

      UNION ALL

      SELECT event_time, 'all_users' as contributor_category
      FROM commit_comment_github_events
      WHERE LOWER(actor_login) IN (:...all_users)
      AND now() - :range_interval::INTERVAL <= event_time

      UNION ALL

      SELECT event_time, 'active_users' as contributor_category
      FROM commit_comment_github_events
      WHERE LOWER(actor_login) IN (:...active_users)
      AND now() - :range_interval::INTERVAL <= event_time

      UNION ALL

      SELECT event_time, 'new_users' as contributor_category
      FROM commit_comment_github_events
      WHERE LOWER(actor_login) IN (:...new_users)
      AND now() - :range_interval::INTERVAL <= event_time

      UNION ALL

      SELECT event_time, 'alumni_users' as contributor_category
      FROM commit_comment_github_events
      WHERE LOWER(actor_login) IN (:...alumni_users)
      AND now() - :range_interval::INTERVAL <= event_time

      UNION ALL

      SELECT event_time, 'all_users' as contributor_category
      FROM issue_comment_github_events
      WHERE LOWER(actor_login) IN (:...all_users)
      AND now() - :range_interval::INTERVAL <= event_time

      UNION ALL

      SELECT event_time, 'active_users' as contributor_category
      FROM issue_comment_github_events
      WHERE LOWER(actor_login) IN (:...active_users)
      AND now() - :range_interval::INTERVAL <= event_time

      UNION ALL

      SELECT event_time, 'new_users' as contributor_category
      FROM issue_comment_github_events
      WHERE LOWER(actor_login) IN (:...new_users)
      AND now() - :range_interval::INTERVAL <= event_time

      UNION ALL

      SELECT event_time, 'alumni_users' as contributor_category
      FROM issue_comment_github_events
      WHERE LOWER(actor_login) IN (:...alumni_users)
      AND now() - :range_interval::INTERVAL <= event_time

      UNION ALL

      SELECT event_time, 'all_users' as contributor_category
      FROM pull_request_review_comment_github_events
      WHERE LOWER(actor_login) IN (:...all_users)
      AND now() - :range_interval::INTERVAL <= event_time

      UNION ALL

      SELECT event_time, 'active_users' as contributor_category
      FROM pull_request_review_comment_github_events
      WHERE LOWER(actor_login) IN (:...active_users)
      AND now() - :range_interval::INTERVAL <= event_time

      UNION ALL

      SELECT event_time, 'new_users' as contributor_category
      FROM pull_request_review_comment_github_events
      WHERE LOWER(actor_login) IN (:...new_users)
      AND now() - :range_interval::INTERVAL <= event_time

      UNION ALL

      SELECT event_time, 'alumni_users' as contributor_category
      FROM pull_request_review_comment_github_events
      WHERE LOWER(actor_login) IN (:...alumni_users)
      AND now() - :range_interval::INTERVAL <= event_time`;

    const cteQueryWithRepos = `
      SELECT event_time, 'all_users' as contributor_category
      FROM push_github_events
      WHERE LOWER(actor_login) IN (:...all_users)
      AND LOWER(repo_name) IN (:...repos)
      AND push_ref IN('refs/heads/main', 'refs/heads/master')
      AND now() - :range_interval::INTERVAL <= event_time

      UNION ALL

      SELECT event_time, 'active_users' as contributor_category
      FROM push_github_events
      WHERE LOWER(actor_login) IN (:...active_users)
      AND LOWER(repo_name) IN (:...repos)
      AND push_ref IN('refs/heads/main', 'refs/heads/master')
      AND now() - :range_interval::INTERVAL <= event_time

      UNION ALL

      SELECT event_time, 'new_users' as contributor_category
      FROM push_github_events
      WHERE LOWER(actor_login) IN (:...new_users)
      AND LOWER(repo_name) IN (:...repos)
      AND push_ref IN('refs/heads/main', 'refs/heads/master')
      AND now() - :range_interval::INTERVAL <= event_time

      UNION ALL

      SELECT event_time, 'alumni_users' as contributor_category
      FROM push_github_events
      WHERE LOWER(actor_login) IN (:...alumni_users)
      AND LOWER(repo_name) IN (:...repos)
      AND push_ref IN('refs/heads/main', 'refs/heads/master')
      AND now() - :range_interval::INTERVAL <= event_time

      UNION ALL

      SELECT event_time, 'all_users' as contributor_category
      FROM pull_request_github_events
      WHERE LOWER(actor_login) IN (:...all_users)
      AND LOWER(repo_name) IN (:...repos)
      AND pr_action='opened'
      AND now() - :range_interval::INTERVAL <= event_time

      UNION ALL

      SELECT event_time, 'active_users' as contributor_category
      FROM pull_request_github_events
      WHERE LOWER(actor_login) IN (:...active_users)
      AND LOWER(repo_name) IN (:...repos)
      AND pr_action='opened'
      AND now() - :range_interval::INTERVAL <= event_time

      UNION ALL

      SELECT event_time, 'new_users' as contributor_category
      FROM pull_request_github_events
      WHERE LOWER(actor_login) IN (:...new_users)
      AND LOWER(repo_name) IN (:...repos)
      AND pr_action='opened'
      AND now() - :range_interval::INTERVAL <= event_time

      UNION ALL

      SELECT event_time, 'alumni_users' as contributor_category
      FROM pull_request_github_events
      WHERE LOWER(actor_login) IN (:...alumni_users)
      AND LOWER(repo_name) IN (:...repos)
      AND pr_action='opened'
      AND now() - :range_interval::INTERVAL <= event_time

      UNION ALL

      SELECT event_time, 'all_users' as contributor_category
      FROM pull_request_review_github_events
      WHERE LOWER(actor_login) IN (:...all_users)
      AND LOWER(repo_name) IN (:...repos)
      AND pr_review_action='created'
      AND now() - :range_interval::INTERVAL <= event_time

      UNION ALL

      SELECT event_time, 'active_users' as contributor_category
      FROM pull_request_review_github_events
      WHERE LOWER(actor_login) IN (:...active_users)
      AND LOWER(repo_name) IN (:...repos)
      AND pr_review_action='created'
      AND now() - :range_interval::INTERVAL <= event_time

      UNION ALL

      SELECT event_time, 'new_users' as contributor_category
      FROM pull_request_review_github_events
      WHERE LOWER(actor_login) IN (:...new_users)
      AND LOWER(repo_name) IN (:...repos)
      AND pr_review_action='created'
      AND now() - :range_interval::INTERVAL <= event_time

      UNION ALL

      SELECT event_time, 'alumni_users' as contributor_category
      FROM pull_request_review_github_events
      WHERE LOWER(actor_login) IN (:...alumni_users)
      AND LOWER(repo_name) IN (:...repos)
      AND pr_review_action='created'
      AND now() - :range_interval::INTERVAL <= event_time

      UNION ALL

      SELECT event_time, 'all_users' as contributor_category
      FROM issues_github_events
      WHERE LOWER(actor_login) IN (:...all_users)
      AND LOWER(repo_name) IN (:...repos)
      AND issue_action='opened'
      AND now() - :range_interval::INTERVAL <= event_time

      UNION ALL

      SELECT event_time, 'active_users' as contributor_category
      FROM issues_github_events
      WHERE LOWER(actor_login) IN (:...active_users)
      AND LOWER(repo_name) IN (:...repos)
      AND issue_action='opened'
      AND now() - :range_interval::INTERVAL <= event_time

      UNION ALL

      SELECT event_time, 'new_users' as contributor_category
      FROM issues_github_events
      WHERE LOWER(actor_login) IN (:...new_users)
      AND LOWER(repo_name) IN (:...repos)
      AND issue_action='opened'
      AND now() - :range_interval::INTERVAL <= event_time

      UNION ALL

      SELECT event_time, 'alumni_users' as contributor_category
      FROM issues_github_events
      WHERE LOWER(actor_login) IN (:...alumni_users)
      AND LOWER(repo_name) IN (:...repos)
      AND issue_action='opened'
      AND now() - :range_interval::INTERVAL <= event_time

      UNION ALL

      SELECT event_time, 'all_users' as contributor_category
      FROM commit_comment_github_events
      WHERE LOWER(actor_login) IN (:...all_users)
      AND LOWER(repo_name) IN (:...repos)
      AND now() - :range_interval::INTERVAL <= event_time

      UNION ALL

      SELECT event_time, 'active_users' as contributor_category
      FROM commit_comment_github_events
      WHERE LOWER(actor_login) IN (:...active_users)
      AND LOWER(repo_name) IN (:...repos)
      AND now() - :range_interval::INTERVAL <= event_time

      UNION ALL

      SELECT event_time, 'new_users' as contributor_category
      FROM commit_comment_github_events
      WHERE LOWER(actor_login) IN (:...new_users)
      AND LOWER(repo_name) IN (:...repos)
      AND now() - :range_interval::INTERVAL <= event_time

      UNION ALL

      SELECT event_time, 'alumni_users' as contributor_category
      FROM commit_comment_github_events
      WHERE LOWER(actor_login) IN (:...alumni_users)
      AND LOWER(repo_name) IN (:...repos)
      AND now() - :range_interval::INTERVAL <= event_time

      UNION ALL

      SELECT event_time, 'all_users' as contributor_category
      FROM issue_comment_github_events
      WHERE LOWER(actor_login) IN (:...all_users)
      AND LOWER(repo_name) IN (:...repos)
      AND now() - :range_interval::INTERVAL <= event_time

      UNION ALL

      SELECT event_time, 'active_users' as contributor_category
      FROM issue_comment_github_events
      WHERE LOWER(actor_login) IN (:...active_users)
      AND LOWER(repo_name) IN (:...repos)
      AND now() - :range_interval::INTERVAL <= event_time

      UNION ALL

      SELECT event_time, 'new_users' as contributor_category
      FROM issue_comment_github_events
      WHERE LOWER(actor_login) IN (:...new_users)
      AND LOWER(repo_name) IN (:...repos)
      AND now() - :range_interval::INTERVAL <= event_time

      UNION ALL

      SELECT event_time, 'alumni_users' as contributor_category
      FROM issue_comment_github_events
      WHERE LOWER(actor_login) IN (:...alumni_users)
      AND LOWER(repo_name) IN (:...repos)
      AND now() - :range_interval::INTERVAL <= event_time

      UNION ALL

      SELECT event_time, 'all_users' as contributor_category
      FROM pull_request_review_comment_github_events
      WHERE LOWER(actor_login) IN (:...all_users)
      AND LOWER(repo_name) IN (:...repos)
      AND now() - :range_interval::INTERVAL <= event_time

      UNION ALL

      SELECT event_time, 'active_users' as contributor_category
      FROM pull_request_review_comment_github_events
      WHERE LOWER(actor_login) IN (:...active_users)
      AND LOWER(repo_name) IN (:...repos)
      AND now() - :range_interval::INTERVAL <= event_time

      UNION ALL

      SELECT event_time, 'new_users' as contributor_category
      FROM pull_request_review_comment_github_events
      WHERE LOWER(actor_login) IN (:...new_users)
      AND LOWER(repo_name) IN (:...repos)
      AND now() - :range_interval::INTERVAL <= event_time

      UNION ALL

      SELECT event_time, 'alumni_users' as contributor_category
      FROM pull_request_review_comment_github_events
      WHERE LOWER(actor_login) IN (:...alumni_users)
      AND LOWER(repo_name) IN (:...repos)
      AND now() - :range_interval::INTERVAL <= event_time`;

    const entityQb = this.pullRequestGithubEventsRepository.manager.createQueryBuilder();

    if (repos && repos.length > 0) {
      entityQb.addCommonTableExpression(cteQueryWithRepos, "CTE").setParameters({ repos });
    } else {
      entityQb.addCommonTableExpression(cteQueryNoRepos, "CTE");
    }

    entityQb
      .setParameters({ all_users: allUsers })
      .setParameters({ active_users: activeUsers })
      .setParameters({ new_users: newUsers })
      .setParameters({ alumni_users: alumniUsers })
      .setParameters({ range_interval: `${range} days` })
      .select(`time_bucket('1 day', event_time)`, "bucket")
      .addSelect("COUNT(case when contributor_category = 'all_users' then 1 end)", "all")
      .addSelect("COUNT(case when contributor_category = 'active_users' then 1 end)", "active")
      .addSelect("COUNT(case when contributor_category = 'new_users' then 1 end)", "new")
      .addSelect("COUNT(case when contributor_category = 'alumni_users' then 1 end)", "alumni")
      .from("CTE", "CTE")
      .groupBy("bucket")
      .orderBy("bucket", "DESC");

    const entities: DbContributorCategoryTimeframe[] = await entityQb.getRawMany();

    return entities;
  }
}
