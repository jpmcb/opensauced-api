import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CreateHistogramDto } from "../histogram/dtos/create.dto";
import { GetPrevDateISOString } from "../common/util/datetimes";
import { OrderDirectionEnum } from "../common/constants/order-direction.constant";
import { DbCreateGitHubEventsHistogram } from "./entities/create_github_events_histogram.entity";

/*
 * create events, named "CreateEvent" in the GitHub API, are when
 * a GitHub actor creates a new public repo, a new tag, or a new branch in a repo.
 *
 * for further details, refer to: https://docs.github.com/en/rest/using-the-rest-api/github-event-types?apiVersion=2022-11-28
 */

@Injectable()
export class CreateGithubEventsService {
  constructor(
    @InjectRepository(DbCreateGitHubEventsHistogram, "TimescaleConnection")
    private createGitHubEventsHistogramRepository: Repository<DbCreateGitHubEventsHistogram>
  ) {}

  baseQueryBuilder() {
    const builder = this.createGitHubEventsHistogramRepository.manager.createQueryBuilder();

    return builder;
  }

  async genCreateHistogram(options: CreateHistogramDto): Promise<DbCreateGitHubEventsHistogram[]> {
    if (!options.contributor && !options.repo && !options.repoIds) {
      throw new BadRequestException("must provide contributor, repo, or repoIds");
    }

    const { range } = options;
    const order = options.orderDirection ?? OrderDirectionEnum.DESC;
    const startDate = GetPrevDateISOString(options.prev_days_start_date ?? 0);
    const width = options.width ?? 1;

    const queryBuilder = this.baseQueryBuilder();

    queryBuilder
      .select("time_bucket(:width_interval::INTERVAL, event_time)", "bucket")
      .addSelect("count(CASE WHEN LOWER(create_ref_type) = 'tag' THEN 1 END)", "tags_created")
      .addSelect("count(CASE WHEN LOWER(create_ref_type) = 'branch' THEN 1 END)", "branches_created")
      .from("create_github_events", "create_github_events")
      .where(`:start_date::TIMESTAMP >= "create_github_events"."event_time"`, { start_date: startDate })
      .andWhere(`:start_date::TIMESTAMP - :range_interval::INTERVAL <= "create_github_events"."event_time"`, {
        start_date: startDate,
        range_interval: `${range} days`,
      })
      .groupBy("bucket")
      .orderBy("bucket", order)
      .setParameter("width_interval", `${width} days`);

    /* filter on the provided creator actor username */
    if (options.contributor) {
      queryBuilder.andWhere(`LOWER("create_github_events"."actor_login") = LOWER(:actor)`, {
        actor: options.contributor,
      });
    }

    /* filter on the provided repo names */
    if (options.repo) {
      queryBuilder.andWhere(`LOWER("create_github_events"."repo_name") IN (:...repoNames)`, {
        repoNames: options.repo.toLowerCase().split(","),
      });
    }

    /* filter on the provided repo ids */
    if (options.repoIds) {
      queryBuilder.andWhere(`"create_github_events"."repo_id" IN (:...repoIds)`, {
        repoIds: options.repoIds.split(","),
      });
    }

    const rawResults = await queryBuilder.getRawMany();

    return rawResults as DbCreateGitHubEventsHistogram[];
  }
}
