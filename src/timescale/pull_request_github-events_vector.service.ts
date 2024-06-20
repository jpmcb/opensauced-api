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
    repoNames,
  }: {
    embedding: number[];
    range: number;
    prevDaysStartDate: number;
    author?: string;
    repoNames?: string[];
  }): Promise<DbPullRequestGitHubEvents[]> {
    const startDate = GetPrevDateISOString(prevDaysStartDate);
    const queryBuilder = this.pullRequestGithubEventsRepository
      .createQueryBuilder("pull_request_github_events")
      .where(`:start_date::TIMESTAMP >= "pull_request_github_events"."event_time"`, { start_date: startDate })
      .andWhere(`:start_date::TIMESTAMP - :range_interval::INTERVAL <= "pull_request_github_events"."event_time"`, {
        start_date: startDate,
        range_interval: `${range} days`,
      })
      .andWhere("LOWER(pr_author_login) NOT LIKE '%[bot]%'")
      .orderBy(`pull_request_github_events.embedding <=> :vector_embedding::vector`)
      .setParameters({ vector_embedding: `[${embedding.join(",")}]` })
      .limit(5);

    if (author) {
      queryBuilder.andWhere(`LOWER("pull_request_github_events"."pr_author_login") = LOWER(:author)`, {
        author: author.toLowerCase(),
      });
    }

    if (repoNames) {
      queryBuilder.andWhere(`LOWER("pull_request_github_events"."repo_name") IN(:...repoNames)`, {
        repoNames: repoNames.map((name) => name.toLowerCase()),
      });
    }

    return queryBuilder.getMany();
  }
}
