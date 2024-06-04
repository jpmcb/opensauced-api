import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { GetPrevDateISOString } from "../common/util/datetimes";
import { DbIssuesGitHubEvents } from "./entities/issues_github_event.entity";

/*
 * the IssuesGithubEventsVectorService is a service for accessing and doing
 * similarity search on the vectors stored in the IssuesGitHubEvents table
 */

@Injectable()
export class IssuesGithubEventsVectorService {
  constructor(
    @InjectRepository(DbIssuesGitHubEvents, "TimescaleConnection")
    private issuesGithubEventsRepository: Repository<DbIssuesGitHubEvents>
  ) {}

  baseQueryBuilder() {
    return this.issuesGithubEventsRepository.createQueryBuilder("issues_github_events");
  }

  /*
   * given an embedding and a few parameters, this service call will perform
   * the cosine similarity (where the "direction" is captured between embeddings
   * in the "embeddings" column in the database and a provided query embedding).
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
  }): Promise<DbIssuesGitHubEvents[]> {
    const startDate = GetPrevDateISOString(prevDaysStartDate);
    const queryBuilder = this.issuesGithubEventsRepository
      .createQueryBuilder("issues_github_events")
      .where(`:start_date::TIMESTAMP >= "issues_github_events"."event_time"`, { start_date: startDate })
      .andWhere(`:start_date::TIMESTAMP - :range_interval::INTERVAL <= "issues_github_events"."event_time"`, {
        start_date: startDate,
        range_interval: `${range} days`,
      })
      .andWhere("LOWER(issue_author_login) NOT LIKE '%[bot]%'")
      .orderBy(`issues_github_events.embedding <=> :vector_embedding::vector`)
      .setParameters({ vector_embedding: `[${embedding.join(",")}]` })
      .limit(5);

    if (author) {
      queryBuilder.andWhere(`LOWER("issues_github_events"."issue_author_login") = LOWER(:author)`, {
        author: author.toLowerCase(),
      });
    }

    if (repoName) {
      queryBuilder.andWhere(`LOWER("issues_github_events"."repo_name") = LOWER(:repoName)`, {
        repoName: repoName.toLowerCase(),
      });
    }

    return queryBuilder.getMany();
  }
}
