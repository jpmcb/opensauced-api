import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { GetPrevDateISOString } from "../common/util/datetimes";
import { ReleaseHistogramDto, ReleasesDto } from "../histogram/dtos/releases.dto";
import { OrderDirectionEnum } from "../common/constants/order-direction.constant";
import { PageMetaDto } from "../common/dtos/page-meta.dto";
import { PageDto } from "../common/dtos/page.dto";
import {
  DbReleaseGitHubEvent,
  DbReleaseGitHubEventsHistogram,
} from "./entities/release_github_events_histogram.entity";

/*
 * release events, named "ReleaseEvent" in the GitHub API, are when
 * a GitHub actor creates/publishes a release for a repo.
 *
 * for further details, refer to: https://docs.github.com/en/rest/using-the-rest-api/github-event-types?apiVersion=2022-11-28
 */

@Injectable()
export class ReleaseGithubEventsService {
  constructor(
    @InjectRepository(DbReleaseGitHubEventsHistogram, "TimescaleConnection")
    private releaseGitHubEventsRepository: Repository<DbReleaseGitHubEventsHistogram>
  ) {}

  baseQueryBuilder() {
    const builder = this.releaseGitHubEventsRepository.manager.createQueryBuilder();

    return builder;
  }

  async getReleases(options: ReleasesDto): Promise<PageDto<DbReleaseGitHubEvent>> {
    if (!options.contributor && !options.repos && !options.repoIds) {
      throw new BadRequestException("must provide contributor, repo, or repoIds");
    }

    const range = options.range ?? 30;
    const order = options.orderDirection ?? OrderDirectionEnum.DESC;
    const startDate = GetPrevDateISOString(options.prev_days_start_date ?? 0);

    const queryBuilder = this.baseQueryBuilder();

    queryBuilder
      .select("release_name", "title")
      .addSelect("event_time", "release_date_time")
      .addSelect("release_tag", "tag")
      .addSelect("release_target_commit", "target_ref")
      .addSelect("release_is_draft", "is_draft")
      .addSelect("release_is_pre_release", "is_pre_release")
      .addSelect("actor_login", "releaser_login")
      .from("release_github_events", "release_github_events")
      .where(`'${startDate}':: TIMESTAMP >= "release_github_events"."event_time"`)
      .andWhere(`'${startDate}':: TIMESTAMP - INTERVAL '${range} days' <= "release_github_events"."event_time"`)
      .orderBy("event_time", order);

    /* filter on the provided releaser username */
    if (options.contributor) {
      queryBuilder.andWhere(`LOWER("release_github_events"."actor_login") = LOWER(:actor)`, {
        actor: options.contributor,
      });
    }

    /* filter on the provided releaser username */
    if (options.not_contributor) {
      queryBuilder.andWhere(`LOWER("release_github_events"."actor_login") != LOWER(:actor)`, {
        actor: options.not_contributor,
      });
    }

    /* filter on the provided repo names */
    if (options.repos) {
      queryBuilder.andWhere(`LOWER("release_github_events"."repo_name") IN (:...repoNames)`).setParameters({
        repoNames: options.repos.toLowerCase().split(","),
      });
    }

    /* filter on the provided repo ids */
    if (options.repoIds) {
      queryBuilder.andWhere(`"release_github_events"."repo_id" IN (:...repoIds)`).setParameters({
        repoIds: options.repoIds.split(","),
      });
    }

    const cteCounter = this.releaseGitHubEventsRepository.manager
      .createQueryBuilder()
      .addCommonTableExpression(queryBuilder, "CTE")
      .setParameters(queryBuilder.getParameters())
      .select(`COUNT(*) as count`)
      .from("CTE", "CTE");

    const cteCounterResult = await cteCounter.getRawOne<{ count: number }>();
    const itemCount = parseInt(`${cteCounterResult?.count ?? "0"}`, 10);

    queryBuilder.offset(options.skip).limit(options.limit);

    const entities = await queryBuilder.getRawMany<DbReleaseGitHubEvent>();

    const pageMetaDto = new PageMetaDto({
      itemCount,
      pageOptionsDto: {
        page: options.page,
        limit: options.limit,
        skip: options.skip,
      },
    });

    return new PageDto(entities, pageMetaDto);
  }

  async genReleaseHistogram(options: ReleaseHistogramDto): Promise<DbReleaseGitHubEventsHistogram[]> {
    if (!options.contributor && !options.repo && !options.repoIds) {
      throw new BadRequestException("must provide contributor, repo, or repoIds");
    }

    const { range } = options;
    const order = options.orderDirection ?? OrderDirectionEnum.DESC;
    const startDate = GetPrevDateISOString(options.prev_days_start_date ?? 0);
    const width = options.width ?? 1;

    const queryBuilder = this.baseQueryBuilder();

    queryBuilder
      .select(`time_bucket('${width} day', event_time)`, "bucket")
      .addSelect("count(*)", "all_releases")
      .addSelect("count(CASE WHEN release_is_draft = FALSE AND release_is_pre_release = FALSE THEN 1 END)", "releases")
      .addSelect("count(CASE WHEN release_is_draft = TRUE THEN 1 END)", "draft_releases")
      .addSelect("count(CASE WHEN release_is_pre_release = TRUE THEN 1 END)", "pre_releases")
      .from("release_github_events", "release_github_events")
      .where(`'${startDate}':: TIMESTAMP >= "release_github_events"."event_time"`)
      .andWhere(`'${startDate}':: TIMESTAMP - INTERVAL '${range} days' <= "release_github_events"."event_time"`)
      .groupBy("bucket")
      .orderBy("bucket", order);

    /* filter on the provided releaser username */
    if (options.contributor) {
      queryBuilder.andWhere(`LOWER("release_github_events"."actor_login") = LOWER(:actor)`, {
        actor: options.contributor,
      });
    }

    /* filter on the provided repo names */
    if (options.repo) {
      queryBuilder.andWhere(`LOWER("release_github_events"."repo_name") IN (:...repoNames)`).setParameters({
        repoNames: options.repo.toLowerCase().split(","),
      });
    }

    /* filter on the provided repo ids */
    if (options.repoIds) {
      queryBuilder.andWhere(`"release_github_events"."repo_id" IN (:...repoIds)`).setParameters({
        repoIds: options.repoIds.split(","),
      });
    }

    const rawResults = await queryBuilder.getRawMany();

    return rawResults as DbReleaseGitHubEventsHistogram[];
  }
}
