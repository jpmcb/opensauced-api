import { Injectable } from "@nestjs/common";
import { Repository, SelectQueryBuilder } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";

import { PromisePool } from "@supercharge/promise-pool";
import {
  DbContributionStatTimeframe,
  contributionTypeEnum,
} from "../user-lists/entities/contributions-timeframe.entity";
import { ContributionsTimeframeDto } from "../user-lists/dtos/contributions-timeframe.dto";
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
   * this function aggregates contributor stats from multiple events services
   * in parallel.
   *
   * warning! It is assumed that the "users" string input is already valid.
   * make all best efforts to validate and filter invalid user strings before calling this
   */
  private async findContributorStats(
    pageOptionsDto: MostActiveContributorsDto,
    user: string
  ): Promise<DbContributorStat> {
    const contribType = pageOptionsDto.contributorType ?? ContributorStatsTypeEnum.all;
    const range = pageOptionsDto.range!;
    const repos = pageOptionsDto.repos ? pageOptionsDto.repos.toLowerCase().split(",") : undefined;

    const statsFunctions = [
      async () => this.pushGithubEventsService.getPushCountForLogin(user, contribType, range, repos),
      async () => this.pullRequestGithubEventsService.getOpenedPrsCountForAuthor(user, contribType, range, repos),
      async () =>
        this.pullRequestReviewGithubEventsService.getPrReviewCountForReviewer(user, contribType, range, repos),
      async () => this.issuesGithubEventsService.getIssueCountForAuthor(user, contribType, range, repos),
      async () =>
        this.commitCommentsGithubEventsService.getCommitCommentCountForAuthor(user, contribType, range, repos),
      async () => this.issueCommentsGithubEventsService.getIssueCommentCountForAuthor(user, contribType, range, repos),
      async () =>
        this.pullRequestReviewCommentGithubEventsService.getPrReviewCommentCountForAuthor(
          user,
          contribType,
          range,
          repos
        ),
    ];

    const { results } = await PromisePool.withConcurrency(5)
      .for(statsFunctions)
      .useCorrespondingResults()
      .process(async (func) => func());

    const [commits, prs_created, prs_reviewed, issues_created, commit_comments, issue_comments, pr_review_comments] =
      results;

    const contribStat = new DbContributorStat({
      login: user,
      commits: 0,
      prs_created: 0,
      prs_reviewed: 0,
      issues_created: 0,
      commit_comments: 0,
      issue_comments: 0,
      pr_review_comments: 0,
      comments: 0,
      total_contributions: 0,
    });

    if (typeof commits !== "symbol") {
      contribStat.commits = commits;
      contribStat.total_contributions += commits;
    }

    if (typeof prs_created !== "symbol") {
      contribStat.prs_created = prs_created;
      contribStat.total_contributions += prs_created;
    }

    if (typeof prs_reviewed !== "symbol") {
      contribStat.prs_reviewed = prs_reviewed;
      contribStat.total_contributions += prs_reviewed;
    }

    if (typeof issues_created !== "symbol") {
      contribStat.issues_created = issues_created;
      contribStat.total_contributions += issues_created;
    }

    if (typeof commit_comments !== "symbol") {
      contribStat.commit_comments = commit_comments;
      contribStat.comments += commit_comments;
    }

    if (typeof issue_comments !== "symbol") {
      contribStat.issue_comments = issue_comments;
      contribStat.comments += issue_comments;
    }

    if (typeof pr_review_comments !== "symbol") {
      contribStat.pr_review_comments = pr_review_comments;
      contribStat.comments += pr_review_comments;
    }

    return contribStat;
  }

  /*
   * this function aggregates contributor stats from multiple events services
   * in parallel.
   *
   * warning! It is assumed that the "users" string input is already valid.
   * make all best efforts to validate and filter invalid user strings before calling this
   */
  async findAllContributionsByProject(
    pageOptionsDto: ContributionsByProjectDto,
    users: string[]
  ): Promise<DbContributionsProjects[]> {
    const aggregatedStats: Record<string, DbContributionsProjects> = {};

    const range = pageOptionsDto.range!;
    const repos = pageOptionsDto.repos ? pageOptionsDto.repos.toLowerCase().split(",") : undefined;

    /*
     * only process 1 users info at a time since there may be race conditions with
     * building the Record.
     */
    await PromisePool.withConcurrency(1)
      .for(users)
      .process(async (user) => {
        const statsFunctions = [
          async () => this.pushGithubEventsService.getPushEventsAllForLogin(user, range, repos),
          async () => this.pullRequestGithubEventsService.getOpenedPullReqEventsForLogin(user, range, repos),
          async () =>
            this.pullRequestReviewGithubEventsService.getCreatedPullReqReviewEventsForLogin(user, range, repos),
          async () => this.issuesGithubEventsService.getCreatedIssueEventsForLogin(user, range, repos),
          async () => this.commitCommentsGithubEventsService.getCommitCommentEventsForLogin(user, range, repos),
          async () => this.issueCommentsGithubEventsService.getIssueCommentEventsForLogin(user, range, repos),
          async () =>
            this.pullRequestReviewCommentGithubEventsService.getPullReqReviewCommentEventsForLogin(user, range, repos),
        ];

        const { results, errors } = await PromisePool.withConcurrency(5)
          .for(statsFunctions)
          .useCorrespondingResults()
          .process(async (func) => func());

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

        if (typeof commits !== "symbol") {
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
        }

        if (typeof prs_created !== "symbol") {
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
        }

        if (typeof prs_reviewed !== "symbol") {
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
        }

        if (typeof issues_created !== "symbol") {
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
        }

        if (typeof commit_comments !== "symbol") {
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
        }

        if (typeof issue_comments !== "symbol") {
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
        }

        if (typeof pr_review_comments !== "symbol") {
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
        }
      });

    return Object.values(aggregatedStats);
  }

  async findAllContributionsByTimeframe(
    pageOptionsDto: ContributionsTimeframeDto,
    users: string[]
  ): Promise<DbContributionStatTimeframe[]> {
    const aggregatedStats: Record<string, DbContributionStatTimeframe> = {};

    const range = pageOptionsDto.range!;
    const repos = pageOptionsDto.repos ? pageOptionsDto.repos.toLowerCase().split(",") : undefined;

    /*
     * only process 1 users info at a time since there may be race conditions with
     * building the Record.
     */
    await PromisePool.withConcurrency(1)
      .for(users)
      .process(async (user) => {
        const statsFunctions = [
          async () => this.pushGithubEventsService.getPushEventsAllForLogin(user, range, repos),
          async () => this.pullRequestGithubEventsService.getOpenedPullReqEventsForLogin(user, range, repos),
          async () =>
            this.pullRequestReviewGithubEventsService.getCreatedPullReqReviewEventsForLogin(user, range, repos),
          async () => this.issuesGithubEventsService.getCreatedIssueEventsForLogin(user, range, repos),
          async () => this.commitCommentsGithubEventsService.getCommitCommentEventsForLogin(user, range, repos),
          async () => this.issueCommentsGithubEventsService.getIssueCommentEventsForLogin(user, range, repos),
          async () =>
            this.pullRequestReviewCommentGithubEventsService.getPullReqReviewCommentEventsForLogin(user, range, repos),
        ];

        const { results, errors } = await PromisePool.for(statsFunctions)
          .withConcurrency(5)
          .useCorrespondingResults()
          .process(async (func) => func());

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

        const addToBucket = (eventTime: Date, contributionType: contributionTypeEnum) => {
          const bucket = new Date(
            eventTime.getUTCFullYear(),
            eventTime.getUTCMonth(),
            eventTime.getUTCDate()
          ).toISOString();

          if (!(bucket in aggregatedStats)) {
            aggregatedStats[bucket] = new DbContributionStatTimeframe();
            aggregatedStats[bucket].bucket = bucket;
            aggregatedStats[bucket].commits = 0;
            aggregatedStats[bucket].prs_created = 0;
            aggregatedStats[bucket].prs_reviewed = 0;
            aggregatedStats[bucket].issues_created = 0;
            aggregatedStats[bucket].commit_comments = 0;
            aggregatedStats[bucket].issue_comments = 0;
            aggregatedStats[bucket].pr_review_comments = 0;
            aggregatedStats[bucket].comments = 0;
            aggregatedStats[bucket].total_contributions = 0;
          }

          switch (contributionType) {
            case contributionTypeEnum.commit:
              aggregatedStats[bucket].commits++;
              aggregatedStats[bucket].total_contributions++;
              break;

            case contributionTypeEnum.pr:
              aggregatedStats[bucket].prs_created++;
              aggregatedStats[bucket].total_contributions++;
              break;

            case contributionTypeEnum.pr_review:
              aggregatedStats[bucket].prs_reviewed++;
              aggregatedStats[bucket].total_contributions++;
              break;

            case contributionTypeEnum.issue:
              aggregatedStats[bucket].issues_created++;
              aggregatedStats[bucket].total_contributions++;
              break;

            case contributionTypeEnum.commit_comment:
              aggregatedStats[bucket].commit_comments++;
              aggregatedStats[bucket].comments++;
              break;

            case contributionTypeEnum.issue_comment:
              aggregatedStats[bucket].issue_comments++;
              aggregatedStats[bucket].comments++;
              break;

            case contributionTypeEnum.pr_review_comment:
              aggregatedStats[bucket].pr_review_comments++;
              aggregatedStats[bucket].comments++;
              break;

            default:
              console.error("got unhandled contributor timeframe enum", contributionType);
              break;
          }
        };

        if (typeof commits !== "symbol") {
          commits.forEach((commit) => addToBucket(commit.event_time, contributionTypeEnum.commit));
        }

        if (typeof prs_created !== "symbol") {
          prs_created.forEach((pr) => addToBucket(pr.event_time, contributionTypeEnum.pr));
        }

        if (typeof prs_reviewed !== "symbol") {
          prs_reviewed.forEach((pr_review) => addToBucket(pr_review.event_time, contributionTypeEnum.pr_review));
        }

        if (typeof issues_created !== "symbol") {
          issues_created.forEach((issue) => addToBucket(issue.event_time, contributionTypeEnum.issue));
        }

        if (typeof commit_comments !== "symbol") {
          commit_comments.forEach((commit_comment) =>
            addToBucket(commit_comment.event_time, contributionTypeEnum.commit_comment)
          );
        }

        if (typeof issue_comments !== "symbol") {
          issue_comments.forEach((issue_comment) =>
            addToBucket(issue_comment.event_time, contributionTypeEnum.issue_comment)
          );
        }

        if (typeof pr_review_comments !== "symbol") {
          pr_review_comments.forEach((pr_review_comment) =>
            addToBucket(pr_review_comment.event_time, contributionTypeEnum.pr_review_comment)
          );
        }
      });

    return Object.values(aggregatedStats);
  }
}
