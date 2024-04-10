import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { GetPrevDateISOString } from "../common/util/datetimes";
import { DbPullRequestGitHubEvents } from "./entities/pull_request_github_event.entity";

/*
 * the PullRequestGithubEventsVectorService is a service for accessing and doing
 * similarity search on the vectors stored in the PullRequestGitHubEvents table
 */

@Injectable()
export class PullRequestGithubEventsVectorService {
  constructor(
    @InjectRepository(DbPullRequestGitHubEvents, "TimescaleConnection")
    private pullRequestGithubEventsRepository: Repository<DbPullRequestGitHubEvents>
  ) {}

  baseQueryBuilder() {
    return this.pullRequestGithubEventsRepository.createQueryBuilder("pull_request_github_events");
  }

  /*
   * given an embedding and a few parameters, this service call will perform
   * the cosine similarity (where the "direction" is captured between embeddings
   * in the "embeddigns" column in the database and a provided query embedding).
   * It is limited to the top 5 most similar results.
   */
  async cosineSimilarity({
    embedding,
    range,
    prevDaysStartDate,
    author,
    repoName,
  }: {
    embedding: number[];
    range: number;
    prevDaysStartDate: number;
    author?: string;
    repoName?: string;
  }): Promise<DbPullRequestGitHubEvents[]> {
    const startDate = GetPrevDateISOString(prevDaysStartDate);
    const queryBuilder = this.pullRequestGithubEventsRepository
      .createQueryBuilder("pull_request_github_events")
      .where(`'${startDate}'::TIMESTAMP >= "pull_request_github_events"."event_time"`)
      .andWhere(`'${startDate}'::TIMESTAMP - INTERVAL '${range} days' <= "pull_request_github_events"."event_time"`)
      .orderBy(`pull_request_github_events.embedding <=> '[${embedding.join(",")}]'`, "ASC")
      .limit(5);

    if (author) {
      queryBuilder.andWhere(`LOWER("pull_request_github_events"."pr_author_login") = LOWER(:author)`, {
        author: author.toLowerCase(),
      });
    }

    if (repoName) {
      queryBuilder.andWhere(`LOWER("pull_request_github_events"."pr_repo_name") = LOWER(:repoName)`, {
        repoName: repoName.toLowerCase(),
      });
    }

    return queryBuilder.getMany();
  }
}
