import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { PullRequestReviewCommentHistogramDto } from "../histogram/dtos/pull_request_review_comment.dto";
import { GetPrevDateISOString } from "../common/util/datetimes";
import { OrderDirectionEnum } from "../common/constants/order-direction.constant";
import { DbPullRequestReviewCommentGitHubEventsHistogram } from "./entities/pull_request_review_comment_github_events_histogram.entity";
import { applyContribTypeEnumFilters } from "./common/counts";
import { ContributorStatsTypeEnum } from "./dtos/most-active-contrib.dto";
import { DbPullRequestReviewCommentGitHubEvents } from "./entities/pull_request_review_comment_github_events.entity";

/*
 * pull request review comment events, named "PullRequestReviewCommentEvent" in the GitHub API, are when
 * a GitHub actor creates/edits a pull request review comment. These are the threaded
 * comments you'll see in a pull request.
 *
 * for further details, refer to: https://docs.github.com/en/rest/using-the-rest-api/github-event-types?apiVersion=2022-11-28
 */

@Injectable()
export class PullRequestReviewCommentGithubEventsService {
  constructor(
    @InjectRepository(DbPullRequestReviewCommentGitHubEvents, "TimescaleConnection")
    private pullRequestReviewCommentGitHubEventsRepository: Repository<DbPullRequestReviewCommentGitHubEvents>
  ) {}

  baseQueryBuilder() {
    const builder = this.pullRequestReviewCommentGitHubEventsRepository.createQueryBuilder();

    return builder;
  }

  async getPrReviewCommentCountForAuthor(
    username: string,
    contribType: ContributorStatsTypeEnum,
    range: number,
    repos?: string[]
  ): Promise<number> {
    const queryBuilder = this.pullRequestReviewCommentGitHubEventsRepository.manager
      .createQueryBuilder()
      .select("COALESCE(COUNT(*), 0) AS pr_review_comments")
      .from("pull_request_review_comment_github_events", "pull_request_review_comment_github_events")
      .where(`LOWER(actor_login) = '${username}'`)
      .andWhere(`now() - INTERVAL '${range} days' <= event_time`)
      .groupBy("LOWER(actor_login)");

    if (repos && repos.length > 0) {
      queryBuilder.andWhere(`LOWER(repo_name) IN (:...repos)`, { repos });
    }

    applyContribTypeEnumFilters(contribType, queryBuilder, range);

    const result = await queryBuilder.getRawOne<{ pr_review_comments: number }>();
    const parsedResult = parseFloat(`${result?.pr_review_comments ?? "0"}`);

    return parsedResult;
  }

  async getPullReqReviewCommentEventsForLogin(
    username: string,
    range: number,
    repos?: string[]
  ): Promise<DbPullRequestReviewCommentGitHubEvents[]> {
    const queryBuilder = this.baseQueryBuilder()
      .where(`LOWER(actor_login) = '${username}'`)
      .andWhere(`event_time > NOW() - INTERVAL '${range} days'`);

    if (repos && repos.length > 0) {
      queryBuilder.andWhere(`LOWER(repo_name) IN (:...repos)`, { repos });
    }

    return queryBuilder.getMany();
  }

  async genPullRequestReviewCommentHistogram(
    options: PullRequestReviewCommentHistogramDto
  ): Promise<DbPullRequestReviewCommentGitHubEventsHistogram[]> {
    if (!options.contributor && !options.repo && !options.repoIds) {
      throw new BadRequestException("must provide contributor, repo, or repoIds");
    }

    const { range } = options;
    const order = options.orderDirection ?? OrderDirectionEnum.DESC;
    const startDate = GetPrevDateISOString(options.prev_days_start_date ?? 0);
    const width = options.width ?? 1;

    const queryBuilder = this.pullRequestReviewCommentGitHubEventsRepository.manager
      .createQueryBuilder()
      .select(`time_bucket('${width} day', event_time)`, "bucket")
      .addSelect("count(CASE WHEN LOWER(pr_review_comment_action) = 'created' THEN 1 END)", "all_review_comments")
      .addSelect(
        "count(CASE WHEN LOWER(review_comment_author_association) = 'collaborator' THEN 1 END)",
        "collaborator_associated_review_comments"
      )
      .addSelect(
        "count(CASE WHEN LOWER(review_comment_author_association) = 'contributor' THEN 1 END)",
        "contributor_associated_review_comments"
      )
      .addSelect(
        "count(CASE WHEN LOWER(review_comment_author_association) = 'member' THEN 1 END)",
        "member_associated_review_comments"
      )
      .addSelect(
        "count(CASE WHEN LOWER(review_comment_author_association) = 'none' THEN 1 END)",
        "non_associated_review_comments"
      )
      .addSelect(
        "count(CASE WHEN LOWER(review_comment_author_association) = 'owner' THEN 1 END)",
        "owner_associated_review_comments"
      )
      .from("pull_request_review_comment_github_events", "pull_request_review_comment_github_events")
      .where(`'${startDate}':: TIMESTAMP >= "pull_request_review_comment_github_events"."event_time"`)
      .andWhere(
        `'${startDate}':: TIMESTAMP - INTERVAL '${range} days' <= "pull_request_review_comment_github_events"."event_time"`
      )
      .groupBy("bucket")
      .orderBy("bucket", order);

    /* filter on the provided pull request review author */
    if (options.contributor) {
      queryBuilder.andWhere(
        `LOWER("pull_request_review_comment_github_events"."review_comment_author_login") = LOWER(:author)`,
        {
          author: options.contributor,
        }
      );
    }

    /* filter on the provided repo names */
    if (options.repo) {
      queryBuilder
        .andWhere(`LOWER("pull_request_review_comment_github_events"."repo_name") IN (:...repoNames)`)
        .setParameters({
          repoNames: options.repo.toLowerCase().split(","),
        });
    }

    /* filter on the provided repo ids */
    if (options.repoIds) {
      queryBuilder.andWhere(`"pull_request_review_comment_github_events"."repo_id" IN (:...repoIds)`).setParameters({
        repoIds: options.repoIds.split(","),
      });
    }

    const rawResults = await queryBuilder.getRawMany();

    return rawResults as DbPullRequestReviewCommentGitHubEventsHistogram[];
  }
}
