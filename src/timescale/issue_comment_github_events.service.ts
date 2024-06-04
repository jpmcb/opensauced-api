import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { IssueCommentsHistogramDto } from "../histogram/dtos/issue_comments.dto";
import { GetPrevDateISOString } from "../common/util/datetimes";
import { OrderDirectionEnum } from "../common/constants/order-direction.constant";
import {
  DbIssueCommentGitHubEventsHistogram,
  DbTopCommentGitHubEventsHistogram,
} from "./entities/issue_comment_github_events_histogram.entity";
import { DbPullRequestReviewCommentGitHubEventsHistogram } from "./entities/pull_request_review_comment_github_events_histogram.entity";
import { applyContribTypeEnumFilters } from "./common/counts";
import { ContributorStatsTypeEnum } from "./dtos/most-active-contrib.dto";
import { DbIssueCommentGitHubEvents } from "./entities/issue_comment_github_events.entity";

/*
 * issue comment events, named "IssueCommentEvent" in the GitHub API, are when
 * a GitHub actor makes a comment in an issue or pull request.
 *
 * IMPORTANT NOTE: "issues" in the context of the GitHub API refer to BOTH pull
 * requests and actual issues. So, comments in this service are for both issues and prs.
 * For pull request review specific comments, see the PullRequestReviewGithubEventsService
 * and the PullRequestReviewCommentGithubEventsService.
 *
 * for further details, refer to: https://docs.github.com/en/rest/using-the-rest-api/github-event-types?apiVersion=2022-11-28
 */

@Injectable()
export class IssueCommentGithubEventsService {
  constructor(
    @InjectRepository(DbIssueCommentGitHubEvents, "TimescaleConnection")
    private issueCommentGitHubEventsRepository: Repository<DbIssueCommentGitHubEvents>,
    @InjectRepository(DbPullRequestReviewCommentGitHubEventsHistogram, "TimescaleConnection")
    private pullRequestReviewCommentGitHubEventsHistogramRepository: Repository<DbPullRequestReviewCommentGitHubEventsHistogram>
  ) {}

  baseQueryBuilder() {
    const builder = this.issueCommentGitHubEventsRepository.createQueryBuilder();

    return builder;
  }

  async getIssueCommentEventsForLogin(
    username: string,
    range: number,
    repos?: string[]
  ): Promise<DbIssueCommentGitHubEvents[]> {
    const queryBuilder = this.baseQueryBuilder()
      .where("LOWER(actor_login) = :username", { username })
      .andWhere("event_time > NOW() - :range_interval::INTERVAL", { range_interval: `${range} days` });

    if (repos && repos.length > 0) {
      queryBuilder.andWhere("LOWER(repo_name) IN (:...repos)", { repos });
    }

    return queryBuilder.getMany();
  }

  async getIssueCommentCountForAuthor(
    username: string,
    contribType: ContributorStatsTypeEnum,
    range: number,
    repos?: string[]
  ): Promise<number> {
    const queryBuilder = this.issueCommentGitHubEventsRepository.manager
      .createQueryBuilder()
      .select("COALESCE(COUNT(*), 0) AS issue_comments")
      .from("issue_comment_github_events", "issue_comment_github_events")
      .where("LOWER(actor_login) = :username", { username })
      .groupBy("LOWER(actor_login)");

    if (repos && repos.length > 0) {
      queryBuilder.andWhere(`LOWER(repo_name) IN (:...repos)`, { repos });
    }

    applyContribTypeEnumFilters(contribType, queryBuilder, range);

    const result = await queryBuilder.getRawOne<{ issue_comments: number }>();
    const parsedResult = parseFloat(`${result?.issue_comments ?? "0"}`);

    return parsedResult;
  }

  async genIssueCommentHistogram(options: IssueCommentsHistogramDto): Promise<DbIssueCommentGitHubEventsHistogram[]> {
    if (!options.contributor && !options.repo && !options.repoIds) {
      throw new BadRequestException("must provide contributor, repo, or repoIds");
    }

    const { range } = options;
    const order = options.orderDirection ?? OrderDirectionEnum.DESC;
    const startDate = GetPrevDateISOString(options.prev_days_start_date ?? 0);
    const width = options.width ?? 1;

    const queryBuilder = this.issueCommentGitHubEventsRepository.manager
      .createQueryBuilder()
      .select(`time_bucket(:width_interval::INTERVAL, event_time)`, "bucket")
      .addSelect("count(CASE WHEN LOWER(issue_comment_action) = 'created' THEN 1 END)", "all_comments")
      .addSelect(
        "count(CASE WHEN LOWER(comment_author_association) = 'collaborator' THEN 1 END)",
        "collaborator_associated_comments"
      )
      .addSelect(
        "count(CASE WHEN LOWER(comment_author_association) = 'contributor' THEN 1 END)",
        "contributor_associated_comments"
      )
      .addSelect(
        "count(CASE WHEN LOWER(comment_author_association) = 'member' THEN 1 END)",
        "member_associated_comments"
      )
      .addSelect("count(CASE WHEN LOWER(comment_author_association) = 'none' THEN 1 END)", "non_associated_comments")
      .addSelect("count(CASE WHEN LOWER(comment_author_association) = 'owner' THEN 1 END)", "owner_associated_comments")
      .addSelect("count(CASE WHEN issue_is_pr = TRUE THEN 1 END)", "pr_comments")
      .addSelect("count(CASE WHEN issue_is_pr = FALSE THEN 1 END)", "issue_comments")
      .from("issue_comment_github_events", "issue_comment_github_events")
      .where(`:start_date::TIMESTAMP >= "issue_comment_github_events"."event_time"`, { start_date: startDate })
      .andWhere(`:start_date::TIMESTAMP - :range_interval::INTERVAL <= "issue_comment_github_events"."event_time"`, {
        start_date: startDate,
        range_interval: `${range} days`,
      })
      .groupBy("bucket")
      .orderBy("bucket", order)
      .setParameter("width_interval", `${width} days`);

    /* filter on the provided issue comment author */
    if (options.contributor) {
      queryBuilder.andWhere(`LOWER("issue_comment_github_events"."comment_author_login") = LOWER(:author)`, {
        author: options.contributor,
      });
    }

    /* filter on the provided repo names */
    if (options.repo) {
      queryBuilder.andWhere(`LOWER("issue_comment_github_events"."repo_name") IN (:...repoNames)`, {
        repoNames: options.repo.toLowerCase().split(","),
      });
    }

    /* filter on the provided repo ids */
    if (options.repoIds) {
      queryBuilder.andWhere(`"issue_comment_github_events"."repo_id" IN (:...repoIds)`, {
        repoIds: options.repoIds.split(","),
      });
    }

    const rawResults = await queryBuilder.getRawMany();

    return rawResults as DbIssueCommentGitHubEventsHistogram[];
  }

  async genCommentTopHistogram(): Promise<DbTopCommentGitHubEventsHistogram[]> {
    const issueCommentsCte = this.issueCommentGitHubEventsRepository.manager
      .createQueryBuilder()
      .select("repo_name")
      .addSelect("time_bucket('1 day', event_time)", "bucket")
      .addSelect("count(*)", "comment_count")
      .from("issue_comment_github_events", "issue_comment_github_events")
      .where(`now() - INTERVAL '1 days' <= "event_time"`)
      .groupBy("bucket, repo_name")
      .orderBy("comment_count", "DESC")
      .limit(100);

    const prReviewCommentsCte = this.pullRequestReviewCommentGitHubEventsHistogramRepository.manager
      .createQueryBuilder()
      .select("repo_name")
      .addSelect("time_bucket('1 day', event_time)", "bucket")
      .addSelect("count(*)", "comment_count")
      .from("pull_request_review_comment_github_events", "pull_request_review_comment_github_events")
      .where(`now() - INTERVAL '1 days' <= "event_time"`)
      .groupBy("bucket, repo_name")
      .orderBy("comment_count", "DESC")
      .limit(100);

    const combinedComments = `
      SELECT * FROM issue_comments_cte
      UNION ALL
      SELECT * FROM pr_review_comments_cte
    `;

    const queryBuilder = this.issueCommentGitHubEventsRepository.manager
      .createQueryBuilder()
      .addCommonTableExpression(issueCommentsCte, "issue_comments_cte")
      .setParameters(issueCommentsCte.getParameters())
      .addCommonTableExpression(prReviewCommentsCte, "pr_review_comments_cte")
      .setParameters(prReviewCommentsCte.getParameters())
      .addCommonTableExpression(combinedComments, "combined_comments_cte")
      .select("repo_name")
      .addSelect("bucket")
      .addSelect("CAST(SUM(comment_count) AS INTEGER)", "comment_count")
      .from("combined_comments_cte", "combined_comments_cte")
      .groupBy("bucket, repo_name")
      .orderBy("comment_count", "DESC")
      .limit(100);

    const rawResults = await queryBuilder.getRawMany();

    return rawResults as DbTopCommentGitHubEventsHistogram[];
  }
}
