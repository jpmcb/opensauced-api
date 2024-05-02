import { Injectable } from "@nestjs/common";
import { Repository, SelectQueryBuilder } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";

import { PromisePool } from "@supercharge/promise-pool";
import { ContributionsByProjectDto } from "../user-lists/dtos/contributions-by-project.dto";
import { DbContributionsProjects } from "../user-lists/entities/contributions-projects.entity";
import { DbPullRequestGitHubEvents } from "./entities/pull_request_github_event.entity";
import { ContributorStatsTypeEnum, MostActiveContributorsDto } from "./dtos/most-active-contrib.dto";
import { DbContributorStat } from "./entities/contributor_devstat.entity";
import { PushGithubEventsService } from "./push_github_events.service";
import { PullRequestGithubEventsService } from "./pull_request_github_events.service";
import { PullRequestReviewGithubEventsService } from "./pull_request_review_github_events.service";
import { IssuesGithubEventsService } from "./issues_github_events.service";
import { CommitCommentGithubEventsService } from "./commit_comment_github_events.service";
import { IssueCommentGithubEventsService } from "./issue_comment_github_events.service";
import { PullRequestReviewCommentGithubEventsService } from "./pull_request_review_comment_github_events.service";

@Injectable()
export class ContributorDevstatsService {
  constructor(
    @InjectRepository(DbPullRequestGitHubEvents, "TimescaleConnection")
    private pullRequestGithubEventsRepository: Repository<DbPullRequestGitHubEvents>,
    private pushGithubEventsService: PushGithubEventsService,
    private pullRequestGithubEventsService: PullRequestGithubEventsService,
    private pullRequestReviewGithubEventsService: PullRequestReviewGithubEventsService,
    private pullRequestReviewCommentGithubEventsService: PullRequestReviewCommentGithubEventsService,
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
      async () =>
        this.pullRequestReviewCommentGithubEventsService.getPrReviewCommentCountForAuthor(user, contribType, range),
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

  async findAllContributionsByProject(
    pageOptionsDto: ContributionsByProjectDto,
    users: string[]
  ): Promise<DbContributionsProjects[]> {
    const aggregatedStats: Record<string, DbContributionsProjects> = {};

    const range = pageOptionsDto.range!;

    /*
     * only process 1 users info at a time since there may be race conditions with
     * building the Record.
     */
    await PromisePool.withConcurrency(1)
      .for(users)
      .process(async (user) => {
        const statsFunctions = [
          async () => this.pushGithubEventsService.getPushEventsAllForLogin(user, range),
          async () => this.pullRequestGithubEventsService.getOpenedPullReqEventsForLogin(user, range),
          async () => this.pullRequestReviewGithubEventsService.getCreatedPullReqReviewEventsForLogin(user, range),
          async () => this.issuesGithubEventsService.getCreatedIssueEventsForLogin(user, range),
          async () => this.commitCommentsGithubEventsService.getCommitCommentEventsForLogin(user, range),
          async () => this.issueCommentsGithubEventsService.getIssueCommentEventsForLogin(user, range),
          async () =>
            this.pullRequestReviewCommentGithubEventsService.getPullReqReviewCommentEventsForLogin(user, range),
        ];

        const { results, errors } = await PromisePool.withConcurrency(5)
          .for(statsFunctions)
          .process(async (func) => func());

        console.log(results.length);

        if (errors.length !== 0) {
          console.error("Errors occurred:", errors);
        }

        const [
          commits,
          prs_created,
          prs_reviewed,
          issues_created,
          commit_comments,
          issue_comments,
          pr_review_comments,
        ] = results;

        commits.forEach((commit) => {
          if (commit.repo_name in aggregatedStats) {
            aggregatedStats[commit.repo_name].commits++;
            aggregatedStats[commit.repo_name].total_contributions++;
          } else {
            aggregatedStats[commit.repo_name] = new DbContributionsProjects();
            aggregatedStats[commit.repo_name].repo_name = commit.repo_name;
            aggregatedStats[commit.repo_name].commits = 1;
            aggregatedStats[commit.repo_name].total_contributions = 1;
          }
        });

        prs_created.forEach((pr) => {
          if (pr.repo_name in aggregatedStats) {
            aggregatedStats[pr.repo_name].prs_created++;
            aggregatedStats[pr.repo_name].total_contributions++;
          } else {
            aggregatedStats[pr.repo_name] = new DbContributionsProjects();
            aggregatedStats[pr.repo_name].repo_name = pr.repo_name;
            aggregatedStats[pr.repo_name].prs_created = 1;
            aggregatedStats[pr.repo_name].total_contributions = 1;
          }
        });

        prs_reviewed.forEach((pr) => {
          if (pr.repo_name in aggregatedStats) {
            aggregatedStats[pr.repo_name].prs_reviewed++;
            aggregatedStats[pr.repo_name].total_contributions++;
          } else {
            aggregatedStats[pr.repo_name] = new DbContributionsProjects();
            aggregatedStats[pr.repo_name].repo_name = pr.repo_name;
            aggregatedStats[pr.repo_name].prs_reviewed = 1;
            aggregatedStats[pr.repo_name].total_contributions = 1;
          }
        });

        issues_created.forEach((issue) => {
          if (issue.repo_name in aggregatedStats) {
            aggregatedStats[issue.repo_name].issues_created++;
            aggregatedStats[issue.repo_name].total_contributions++;
          } else {
            aggregatedStats[issue.repo_name] = new DbContributionsProjects();
            aggregatedStats[issue.repo_name].repo_name = issue.repo_name;
            aggregatedStats[issue.repo_name].issues_created = 1;
            aggregatedStats[issue.repo_name].total_contributions = 1;
          }
        });

        commit_comments.forEach((comment) => {
          if (comment.repo_name in aggregatedStats) {
            aggregatedStats[comment.repo_name].commit_comments++;
            aggregatedStats[comment.repo_name].comments++;
          } else {
            aggregatedStats[comment.repo_name] = new DbContributionsProjects();
            aggregatedStats[comment.repo_name].repo_name = comment.repo_name;
            aggregatedStats[comment.repo_name].commit_comments = 1;
            aggregatedStats[comment.repo_name].comments = 1;
          }
        });

        issue_comments.forEach((comment) => {
          if (comment.repo_name in aggregatedStats) {
            aggregatedStats[comment.repo_name].issue_comments++;
            aggregatedStats[comment.repo_name].comments++;
          } else {
            aggregatedStats[comment.repo_name] = new DbContributionsProjects();
            aggregatedStats[comment.repo_name].repo_name = comment.repo_name;
            aggregatedStats[comment.repo_name].issue_comments = 1;
            aggregatedStats[comment.repo_name].comments = 1;
          }
        });

        pr_review_comments.forEach((comment) => {
          if (comment.repo_name in aggregatedStats) {
            aggregatedStats[comment.repo_name].pr_review_comments++;
            aggregatedStats[comment.repo_name].comments++;
          } else {
            aggregatedStats[comment.repo_name] = new DbContributionsProjects();
            aggregatedStats[comment.repo_name].repo_name = comment.repo_name;
            aggregatedStats[comment.repo_name].pr_review_comments = 1;
            aggregatedStats[comment.repo_name].comments = 1;
          }
        });
      });

    return Object.values(aggregatedStats);
  }
}
