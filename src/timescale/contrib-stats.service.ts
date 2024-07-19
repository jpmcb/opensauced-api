import { cpus } from "os";
import { Inject, Injectable, forwardRef } from "@nestjs/common";
import { Repository, SelectQueryBuilder } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";

import { PromisePool } from "@supercharge/promise-pool";
import { OrderDirectionEnum } from "../common/constants/order-direction.constant";
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
import { DbWatchGitHubEvents } from "./entities/watch_github_events.entity";
import { DbForkGitHubEvents } from "./entities/fork_github_events.entity";

@Injectable()
export class ContributorDevstatsService {
  constructor(
    @InjectRepository(DbPullRequestGitHubEvents, "TimescaleConnection")
    private pullRequestGithubEventsRepository: Repository<DbPullRequestGitHubEvents>,
    @InjectRepository(DbWatchGitHubEvents, "TimescaleConnection")
    private watchGitHubEventsRepository: Repository<DbWatchGitHubEvents>,
    @InjectRepository(DbForkGitHubEvents, "TimescaleConnection")
    private forkGitHubEventsRepository: Repository<DbForkGitHubEvents>,
    private pushGithubEventsService: PushGithubEventsService,
    @Inject(forwardRef(() => PullRequestGithubEventsService))
    private pullRequestGithubEventsService: PullRequestGithubEventsService,
    private pullRequestReviewGithubEventsService: PullRequestReviewGithubEventsService,
    private pullRequestReviewCommentGithubEventsService: PullRequestReviewCommentGithubEventsService,
    @Inject(forwardRef(() => IssuesGithubEventsService))
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
    const { results, errors } = await PromisePool.withConcurrency(Math.max(2, cpus().length))
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

    const { results } = await PromisePool.withConcurrency(Math.max(2, cpus().length))
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

        const { results, errors } = await PromisePool.withConcurrency(Math.max(2, cpus().length))
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

        const { results, errors } = await PromisePool.withConcurrency(Math.max(2, cpus().length))
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

  /*
   * used to calculate the contributor confidence for the given user
   * by looking at the repos the user forked and if they contributed back within that range.
   */
  private async calculateForkerConfidence(username: string, range: number): Promise<number> {
    let result = 0;

    // gets relevant forkers for the repo over range of days
    const forkedReposQuery = this.forkGitHubEventsRepository.manager
      .createQueryBuilder()
      .select("DISTINCT LOWER(repo_name) as repo_name")
      .from("fork_github_events", "fork_github_events")
      .where("LOWER(actor_login) = LOWER(:username)", { username })
      .andWhere("now() - :range_interval::INTERVAL <= event_time", { range_interval: `${range} days` });

    const allForkedRepos = await forkedReposQuery.getRawMany<{ repo_name: string }>();

    if (allForkedRepos.length === 0) {
      return result;
    }

    const forkedRepos = allForkedRepos
      .map((fork) => (fork.repo_name ? fork.repo_name.toLowerCase() : ""))
      .filter((fork) => fork !== "");

    if (forkedRepos.length === 0) {
      return result;
    }

    // forks set for fast lookup
    const forkedReposSet = new Set(forkedRepos);

    // for each fork, check for corresponding contributions

    const contributionsQuery = this.pullRequestGithubEventsRepository.manager
      .createQueryBuilder()
      .addSelect("DISTINCT repo_name", "repo_name")
      .from("pull_request_github_events", "pull_request_github_events")
      .where("LOWER(pr_author_login) = :username", { username })
      .andWhere("now() - :range_interval::INTERVAL <= event_time", { range_interval: `${range} days` })
      .groupBy("repo_name");

    const contributions = await contributionsQuery.getRawMany<{
      repo_name: string;
    }>();

    contributions.forEach((repo_prs) => {
      if (forkedReposSet.has(repo_prs.repo_name)) {
        /*
         * someone made a contribution within the time window they forked the repo
         */

        result += 1;
      }
    });

    /*
     * someone made a contribution in a repo that wasn't forked in the given
     * time range
     */
    const madeContributionElsewhere = contributions.some((repo_prs) => !forkedReposSet.has(repo_prs.repo_name));

    if (madeContributionElsewhere) {
      result += 0.75;
    }

    return result / forkedRepos.length;
  }

  /*
   * used to calculate the contributor confidence for the given user
   * by looking at the repos the user starred and if they contributed back within that range.
   */
  private async calculateStarGazerConfidence(username: string, range: number): Promise<number> {
    let result = 0;

    // gets relevant star gazers for the repo
    const starGazedReposQuery = this.watchGitHubEventsRepository.manager
      .createQueryBuilder()
      .select("DISTINCT LOWER(repo_name) as repo_name")
      .from("watch_github_events", "watch_github_events")
      .where("LOWER(actor_login) = LOWER(:username)", { username })
      .andWhere("now() - :range_interval::INTERVAL <= event_time", { range_interval: `${range} days` });

    const allStarGazedRepos = await starGazedReposQuery.getRawMany<{ repo_name: string }>();

    if (allStarGazedRepos.length === 0) {
      return result;
    }

    const starGazedRepos = allStarGazedRepos
      .map((starGazedRepo) => (starGazedRepo.repo_name ? starGazedRepo.repo_name.toLowerCase() : ""))
      .filter((starGazedRepo) => starGazedRepo !== "");

    if (starGazedRepos.length === 0) {
      return result;
    }

    // star gazed set for fast lookup
    const starGazedReposSet = new Set(starGazedRepos);

    const contributionsQuery = this.pullRequestGithubEventsRepository.manager
      .createQueryBuilder()
      .select("DISTINCT repo_name", "repo_names")
      .from("pull_request_github_events", "pull_request_github_events")
      .where("LOWER(pr_author_login) = :username", { username })
      .andWhere("now() - :range_interval::INTERVAL <= event_time", { range_interval: `${range} days` })
      .groupBy("repo_name");

    const contributions = await contributionsQuery.getRawMany<{
      repo_name: string;
    }>();

    contributions.forEach((contribution) => {
      if (starGazedReposSet.has(contribution.repo_name)) {
        // someone made a contribution within the time window they star gazed the repo
        result += 1;
      }
    });

    /*
     * someone made a contribution in a repo that wasn't forked in the given
     * time range
     */
    const madeContributionElsewhere = contributions.some((repo_prs) => !starGazedReposSet.has(repo_prs.repo_name));

    if (madeContributionElsewhere) {
      result += 0.5;
    }

    return result / starGazedRepos.length;
  }

  /*
   * the following is an experimental, proof of concept contributor metric called "Contributor Quality"
   *
   * This is a calculation of how a user's open source contributions are accepted
   * (or rejected) in the open source. The more that are accepted, the higher this score goes.
   * This looks over a static period of 90 days so there is less of a chance to
   * manipulate or game the system: it looks back far enough that it won't
   *
   * Much like a credit score, this is a sliding window. So, eventually, after the 90 day period,
   * a user's score should change slightly where PRs marked as spam or otherwise
   * "hurtful" to the given score drop off and someone can begin "rebuilding" their score.
   *
   * The algorithm is as follows:
   * ----------------------------
   * for the individual contributor:
   *   For each PR in the last 90 days:
   *     If merged: +3 to score
   *     If opened: +1 to score
   *     If closed within 7 days: -1 to score
   *     If "pr_active_lock_reason" is "spam": -99 to score
   *
   *
   * The following can be used as an estimate / "opinion" on what the various
   * scores here mean:
   *
   * -1      : Special case - Likely a spam account. Use extreme caution!
   * 0 - 10  : Of unknown, questionable, or subpar quality
   * 10 - 20 : Good!
   * 20 - 40 : High quality.
   * 40 - 60 : Superb quality, the highest possible.
   */
  private async calculateContributorQuality(username: string): Promise<number> {
    let result = 0;

    const prs = await this.pullRequestGithubEventsService.findAllByPrAuthor(username, {
      limit: 1000,
      skip: 0,
      range: 90,
      orderDirection: OrderDirectionEnum.DESC,
    });

    prs.data.forEach((pr) => {
      // found spam PR
      if (pr.pr_active_lock_reason && pr.pr_active_lock_reason === "spam") {
        result -= 99;
        return;
      }

      // pr was closed within 7 days without merge
      const prCreatedAtPlusSevenDays = new Date(pr.pr_created_at!.setDate(pr.pr_created_at!.getDate() + 7));

      if (
        pr.pr_action === "closed" &&
        !pr.pr_is_merged &&
        pr.pr_closed_at &&
        pr.pr_created_at &&
        prCreatedAtPlusSevenDays > pr.pr_closed_at
      ) {
        result -= 1;
        return;
      }

      // pr was merged successfully
      if (pr.pr_is_merged) {
        result += 3;
        return;
      }

      // pr is opened
      if (pr.pr_action === "opened") {
        result += 1;
      }
    });

    /*
     * short circuit to just return the special case -1 if overall score is below zero
     * likely indicates user has created spam PRs
     */
    if (result < 0) {
      return -1;
    }

    /*
     * if, somehow, someone has surpassed the highest range of our quality score
     * (over 60). I.e., they've had just under 1 PR merge every day for the 90 days
     */
    if (result > 60) {
      result = 60;
    }

    return result;
  }

  /*
   * this is a proof of concept metric called the "Contributor Confidence" for individual users.
   *
   * this confidence score is a percentage metric that determines if certain activities on a
   * repository (starring, forking, etc.) may result in a meaningful contribution. This can be
   * used to determine how likely a user's "fly by" activites result in meaningful contributions
   * within a given time range.
   *
   * it is assumed that ranges past 90 days are generally "low confidence". I.e., someone who forked
   * a repo half a year ago likely isn't a good indicator of them making a meaningful
   * contribution today.
   *
   * This is similar to the contributor confidence that can be applied on a given repo
   * but differs in a significant way: there are far fewer points assigned for contributing
   * elsewhere. This captures the nuanced nature of an individual making alot of stars/forks
   * (which sometimes can just be a simple bookmark) but can surface really supurb
   * individuals who make alot of contributions within open source ecosystems.
   *
   * Currently the algorithm exists as:
   * --------------------------------------------------------------------------
   * Truncate range down to max 90 days
   *
   * For all repos a user stargazed over the time range:
   *   If they made a contribution to the repo in question:
   *     Add 1 to star gazer score for repo
   * Check if user has made a contribution anywhere:
   *   Add 0.5 to star gazer total score
   *
   * Star gazer confidence percentage = score / number of starred repos
   *
   * For all repos a user forked over the time range:
   *   If they made a contribution to the repo in question:
   *     Add 1 to forker score for repo
   * Check if user has made a contribution anywhere:
   *   Add 0.75 to forker total score
   *
   * Forker confidence percentage = score / number of forked repos
   *
   * Finally, calculate:
   *   ( Star gazer score / forker score ) / 2
   *     = confidence score as a percentage
   */
  async calculateContributorConfidenceByUsername(username: string, range: number): Promise<number> {
    range = range > 90 ? 90 : range;

    const forkerConfidence = await this.calculateForkerConfidence(username, range);
    const starGazerConfidence = await this.calculateStarGazerConfidence(username, range);

    return (forkerConfidence + starGazerConfidence) / 2;
  }

  /*
   * this is a proof of concept metric called the "Open Source Contributor Rating" or "OSCR" for short.
   *
   * It is a sort of sliding scale "credit score" ratting that goes from 0 - 100%
   * which is mostly weighted on the "quality" score which measures user's contributions.
   * to open source projects.
   *
   * The OSCR algorithm is as follows:
   * --------------------------------------------------------------------------
   * for the given user:
   *   calculate their confidence score
   *   calculate their quality score:
   *     if quality score is -1, short circuit to an OSCR of 0
   *     normalize the quality score into a percentage
   *
   *   calculate OSCR by taking 80% quality score and 20% confidence score
   */
  async calculateOpenSourceContributorRating(username: string, range: number): Promise<number> {
    const quality = await this.calculateContributorQuality(username);

    /*
     * -1 is a special case indicating some problem in the quality of the
     * user's contirbutions (i.e., some spam was found). Automatically return a 0.
     */
    if (quality === -1) {
      return 0;
    }

    // convert the quality range 0 to 60 into 0% to 100%.
    const qualityPercentage = quality / 60;

    const confidencePercentage = await this.calculateContributorConfidenceByUsername(username, range);

    /*
     * apply weighting:
     * - confidence has a weight of 20%
     * - quality has a weight of 80%
     */
    const weightedConfidence = confidencePercentage * 0.2;
    const weightedQuality = qualityPercentage * 0.8;

    return weightedConfidence + weightedQuality;
  }
}
