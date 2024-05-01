import { Injectable } from "@nestjs/common";
import { Repository, SelectQueryBuilder } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";

import { PromisePool } from "@supercharge/promise-pool";
import { DbPullRequestGitHubEvents } from "./entities/pull_request_github_event.entity";
import { ContributorStatsTypeEnum, MostActiveContributorsDto } from "./dtos/most-active-contrib.dto";
import { DbContributorStat } from "./entities/contributor_devstat.entity";
import { PushGithubEventsService } from "./push_github_events.service";
import { PullRequestGithubEventsService } from "./pull_request_github_events.service";
import { PullRequestReviewGithubEventsService } from "./pull_request_review_github_events.service";
import { IssuesGithubEventsService } from "./issues_github_events.service";
import { CommitCommentGithubEventsService } from "./commit_comment_github_events.service";
import { IssueCommentGithubEventsService } from "./issue_comment_github_events.service";

@Injectable()
export class ContributorDevstatsService {
  constructor(
    @InjectRepository(DbPullRequestGitHubEvents, "TimescaleConnection")
    private pullRequestGithubEventsRepository: Repository<DbPullRequestGitHubEvents>,
    private pushGithubEventsService: PushGithubEventsService,
    private pullRequestGithubEventsService: PullRequestGithubEventsService,
    private pullRequestReviewGithubEventsService: PullRequestReviewGithubEventsService,
    private issuesGithubEventsService: IssuesGithubEventsService,
    private commitCommentsGithubEventsService: CommitCommentGithubEventsService,
    private issueCommentsGithubEventsService: IssueCommentGithubEventsService
  ) {}

  baseQueryBuilder(): SelectQueryBuilder<DbPullRequestGitHubEvents> {
    const builder = this.pullRequestGithubEventsRepository.createQueryBuilder();

    return builder;
  }

  async findAllContributorStats(
    pageOptionsDto: MostActiveContributorsDto,
    users: string[]
  ): Promise<DbContributorStat[]> {
    const { results, errors } = await PromisePool.withConcurrency(5)
      .for(users)
      .process(async (user) => this.findContributorStats(pageOptionsDto, user));

    if (errors.length) {
      console.error("Errors occurred:", errors);
    }

    return results;
  }

  /*
   * warning! It is assumed that the "users" string input is already valid.
   * make all best efforts to validate and filter invalid user strings before calling this
   */
  private async findContributorStats(
    pageOptionsDto: MostActiveContributorsDto,
    user: string
  ): Promise<DbContributorStat> {
    const contribType = pageOptionsDto.contributorType ?? ContributorStatsTypeEnum.all;
    const range = pageOptionsDto.range!;

    const statsFunctions = [
      async () => this.pushGithubEventsService.getPushCountForLogin(user, contribType, range),
      async () => this.pullRequestGithubEventsService.getOpenedPrsCountForAuthor(user, contribType, range),
      async () => this.pullRequestReviewGithubEventsService.getPrReviewCountForReviewer(user, contribType, range),
      async () => this.issuesGithubEventsService.getIssueCountForAuthor(user, contribType, range),
      async () => this.commitCommentsGithubEventsService.getCommitCommentCountForAuthor(user, contribType, range),
      async () => this.issueCommentsGithubEventsService.getIssueCommentCountForAuthor(user, contribType, range),
      async () => this.pullRequestReviewGithubEventsService.getPrReviewCountForReviewer(user, contribType, range),
    ];

    const { results } = await PromisePool.withConcurrency(5)
      .for(statsFunctions)
      .process(async (func) => func());

    const [commits, prs_created, prs_reviewed, issues_created, commit_comments, issue_comments, pr_review_comments] =
      results;

    return new DbContributorStat({
      login: user,
      commits,
      prs_created,
      prs_reviewed,
      issues_created,
      commit_comments,
      issue_comments,
      pr_review_comments,
      comments: commit_comments + issue_comments,
      total_contributions: commits + prs_created + prs_reviewed + issues_created,
    });
  }
}
