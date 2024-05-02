import { OrderDirectionEnum } from "../../common/constants/order-direction.constant";
import { ContributorStatsOrderEnum, MostActiveContributorsDto } from "../dtos/most-active-contrib.dto";
import { DbContributorStat } from "../entities/contributor_devstat.entity";

/*
 * utility function for applying "orderBy" and "orderDirection" to an array
 * of contributor stats. Since contributor stats must be calculated at runtime
 * and there's no way to get the limit/skip on a list of Contributor stats,
 * we must get them all and use this sorting utility function after the fact.
 *
 * This sorts "userStats" in place and doesn't return anything.
 */
export function orderDbContributorStats(pageOptionsDto: MostActiveContributorsDto, userStats: DbContributorStat[]) {
  const orderDir = pageOptionsDto.orderDirection!;

  switch (pageOptionsDto.orderBy) {
    case ContributorStatsOrderEnum.commits:
      userStats.sort((a, b) => {
        if (a.commits < b.commits) {
          return orderDir === OrderDirectionEnum.ASC ? -1 : 1;
        }

        if (a.commits > b.commits) {
          return orderDir === OrderDirectionEnum.ASC ? 1 : -1;
        }

        return 0;
      });
      break;

    case ContributorStatsOrderEnum.prs_created:
      userStats.sort((a, b) => {
        if (a.prs_created < b.prs_created) {
          return orderDir === OrderDirectionEnum.ASC ? -1 : 1;
        }

        if (a.prs_created > b.prs_created) {
          return orderDir === OrderDirectionEnum.ASC ? 1 : -1;
        }

        return 0;
      });
      break;

    case ContributorStatsOrderEnum.total_contributions:
      userStats.sort((a, b) => {
        if (a.total_contributions < b.total_contributions) {
          return orderDir === OrderDirectionEnum.ASC ? -1 : 1;
        }

        if (a.total_contributions > b.total_contributions) {
          return orderDir === OrderDirectionEnum.ASC ? 1 : -1;
        }

        return 0;
      });
      break;
  }
}
