import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CommitCommentsHistogramDto } from "../histogram/dtos/commit_comments.dto";
import { GetPrevDateISOString } from "../common/util/datetimes";
import { OrderDirectionEnum } from "../common/constants/order-direction.constant";
import { DbCommitCommentGitHubEventsHistogram } from "./entities/commit_comment_github_events_histogram.entity";
import { applyContribTypeEnumFilters } from "./common/counts";
import { ContributorStatsTypeEnum } from "./dtos/most-active-contrib.dto";
import { DbCommitCommentGitHubEvents } from "./entities/commit_comment_github_events.entity";

/*
 * commit comment events, named "CommitCommentEvent" in the GitHub API, are when
 * a GitHub actor makes a comment on a specific line(s) within a commit within a repo.
 * This feature is not frequently used but sees some usage by bots.
 *
 * for further details, refer to: https://docs.github.com/en/rest/using-the-rest-api/github-event-types?apiVersion=2022-11-28
 */

@Injectable()
export class CommitCommentGithubEventsService {
  constructor(
    @InjectRepository(DbCommitCommentGitHubEvents, "TimescaleConnection")
    private commitCommentGitHubEventsRepository: Repository<DbCommitCommentGitHubEvents>
  ) {}

  baseQueryBuilder() {
    const builder = this.commitCommentGitHubEventsRepository.createQueryBuilder();

    return builder;
  }

  async getCommitCommentCountForAuthor(
    username: string,
    contribType: ContributorStatsTypeEnum,
    range: number,
    repos?: string[]
  ): Promise<number> {
    const queryBuilder = this.commitCommentGitHubEventsRepository.manager
      .createQueryBuilder()
      .select("COALESCE(COUNT(*), 0) AS commit_comments")
      .from("commit_comment_github_events", "commit_comment_github_events")
      .where(`LOWER(actor_login) = '${username}'`)
      .groupBy("LOWER(actor_login)");

    if (repos && repos.length > 0) {
      queryBuilder.andWhere(`LOWER(repo_name) IN (:...repos)`, { repos });
    }

    applyContribTypeEnumFilters(contribType, queryBuilder, range);

    const result = await queryBuilder.getRawOne<{ commit_comments: number }>();
    const parsedResult = parseFloat(`${result?.commit_comments ?? "0"}`);

    return parsedResult;
  }

  async getCommitCommentEventsForLogin(
    username: string,
    range: number,
    repos?: string[]
  ): Promise<DbCommitCommentGitHubEvents[]> {
    const queryBuilder = this.baseQueryBuilder()
      .where(`LOWER(actor_login) = '${username}'`)
      .andWhere(`event_time > NOW() - INTERVAL '${range} days'`);

    if (repos && repos.length > 0) {
      queryBuilder.andWhere(`LOWER(repo_name) IN (:...repos)`, { repos });
    }

    return queryBuilder.getMany();
  }

  async genCommitCommentHistogram(
    options: CommitCommentsHistogramDto
  ): Promise<DbCommitCommentGitHubEventsHistogram[]> {
    if (!options.contributor && !options.repo && !options.repoIds) {
      throw new BadRequestException("must provide contributor, repo, or repoIds");
    }

    const { range } = options;
    const order = options.orderDirection ?? OrderDirectionEnum.DESC;
    const startDate = GetPrevDateISOString(options.prev_days_start_date ?? 0);
    const width = options.width ?? 1;

    const queryBuilder = this.commitCommentGitHubEventsRepository.manager
      .createQueryBuilder()
      .select(`time_bucket('${width} day', event_time)`, "bucket")
      .addSelect("count(*)", "all_commit_comments")
      .from("commit_comment_github_events", "commit_comment_github_events")
      .where(`'${startDate}':: TIMESTAMP >= "commit_comment_github_events"."event_time"`)
      .andWhere(`'${startDate}':: TIMESTAMP - INTERVAL '${range} days' <= "commit_comment_github_events"."event_time"`)
      .groupBy("bucket")
      .orderBy("bucket", order);

    /* filter on the provided commit comment author */
    if (options.contributor) {
      queryBuilder.andWhere(`LOWER("commit_comment_github_events"."comment_user_login") = LOWER(:user)`, {
        user: options.contributor,
      });
    }

    /* filter on the provided repo names */
    if (options.repo) {
      queryBuilder.andWhere(`LOWER("commit_comment_github_events"."repo_name") IN (:...repoNames)`).setParameters({
        repoNames: options.repo.toLowerCase().split(","),
      });
    }

    /* filter on the provided repo ids */
    if (options.repoIds) {
      queryBuilder.andWhere(`"commit_comment_github_events"."repo_id" IN (:...repoIds)`).setParameters({
        repoIds: options.repoIds.split(","),
      });
    }

    const rawResults = await queryBuilder.getRawMany();

    return rawResults as DbCommitCommentGitHubEventsHistogram[];
  }
}
