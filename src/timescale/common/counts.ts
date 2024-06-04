import { ObjectLiteral, SelectQueryBuilder } from "typeorm";
import { ContributorStatsTypeEnum } from "../dtos/most-active-contrib.dto";

export function applyContribTypeEnumFilters<T extends ObjectLiteral>(
  contributorType: ContributorStatsTypeEnum,
  queryBuilder: SelectQueryBuilder<T>,
  range: number
) {
  switch (contributorType) {
    case ContributorStatsTypeEnum.all:
      queryBuilder.andWhere("event_time >= now() - :range_interval::INTERVAL", {
        range_interval: `${range} days`,
      });
      break;

    case ContributorStatsTypeEnum.active:
      /*
       * pr authors who have contributed in the last 2 date ranges (i.e., for a 30 day,
       * 1 month date range, we should look back 60 days) are considered "active"
       */
      queryBuilder
        .andWhere("event_time >= now() - :double_range_interval::INTERVAL", {
          double_range_interval: `${range + range} days`,
        })
        .having(
          `COUNT(CASE WHEN event_time BETWEEN now() - :range_interval::INTERVAL
           AND now() THEN 1 END) > 0`,
          {
            range_interval: `${range} days`,
          }
        )
        .andHaving(
          `COUNT(CASE WHEN event_time BETWEEN now() - :double_range_interval::INTERVAL
           AND now() - :range_interval::INTERVAL THEN 1 END) > 0`,
          {
            double_range_interval: `${range + range} days`,
            range_interval: `${range} days`,
          }
        );
      break;

    case ContributorStatsTypeEnum.new:
      /*
       * pr authors who have contributed in the current date range
       * but not the previous date range (i.e., for a 30 day range, users who have
       * contributed in the last 30 days but not 30-60 days ago) would be considered "new"
       */
      queryBuilder
        .andWhere("event_time >= now() - :double_range_interval::INTERVAL", {
          double_range_interval: `${range + range} days`,
        })
        .having(
          `COUNT(CASE WHEN event_time BETWEEN now() - :range_interval::INTERVAL
           AND now() THEN 1 END) > 0`,
          {
            range_interval: `${range} days`,
          }
        )
        .andHaving(
          `COUNT(CASE WHEN event_time BETWEEN now() - :double_range_interval::INTERVAL
           AND now() - :range_interval::INTERVAL THEN 1 END) = 0`,
          {
            double_range_interval: `${range * 2} days`,
            range_interval: `${range} days`,
          }
        );
      break;

    case ContributorStatsTypeEnum.alumni: {
      /*
       * pr authors who have not contributed in the current date range
       * but have in the previous date range (i.e., for a 30 day range, users who have not
       * contributed in the last 30 days but have 30-60 days ago) would be considered "alumni"
       */
      queryBuilder
        .andWhere("event_time >= now() - :double_range_interval::INTERVAL", {
          double_range_interval: `${range + range} days`,
        })
        .having(
          `COUNT(CASE WHEN event_time BETWEEN now() - :range_interval::INTERVAL
           AND now() THEN 1 END) = 0`,
          {
            range_interval: `${range} days`,
          }
        )
        .andHaving(
          `COUNT(CASE WHEN event_time BETWEEN now() - :double_range_interval::INTERVAL
           AND now() - :range_interval::INTERVAL THEN 1 END) > 0`,
          {
            double_range_interval: `${range + range} days`,
            range_interval: `${range} days`,
          }
        );
      break;
    }

    default:
      queryBuilder.andWhere("event_time >= now() - :range_interval::INTERVAL", {
        range_interval: `${range} days`,
      });
      break;
  }
}
