import { DbContributorCounts } from "../../timescale/entities/contributor_counts.entity";
import { DbLotteryFactor, LotteryFactorEnum } from "../entities/lotto.entity";

/*
 * the following function can be used on a list of contributor counts,
 * which denote the number of contributions someone has made in a given time-frame,
 * in order to calculate the lottery factor over that time range for both the
 * individual and the broader set of contributions.
 *
 * we define the lottery factor as:
 *   > the minimum number of team members that have to suddenly disappear from a
 *   > project (they won the lottery!) before the project stalls due to lack of
 *   > knowledgeable or competent personnel.
 *
 * One way to look at this algorithm is via "equine" mathematics:
 *   > the lowest number of committers who's total contribution constitutes the
 *   > majority of the codebase
 *   > Source: https://ke4qqq.wordpress.com/2015/02/08/pony-factor-math/
 * Many call this the "pony" factor and is an adopted metric in the Apache software foundation.
 *
 * It is calculated using the following algorithm:
 *   - 1 contributor makes over 50% of commits: Very high risk
 *   - 2 contributors make over 50% of commits: High risk
 *   - 3 to 5 contributors make over 50% of commits: Moderate risk
 *   - Over 5 contributors make over 50% of commits: Low risk
 *
 * And, on an individual level, it is calculated as:
 *   - A contributor has over 50% of commits: Very high risk
 *   - A contributor has between 25-50% of commits: High risk
 *   - A contributor has between 10-25% of commits: Moderate risk
 *   - A contributor has under 10% of commits: Low risk
 */

export function calculateLottoFactor(contribCounts: DbContributorCounts[]): DbLotteryFactor {
  const result = new DbLotteryFactor();

  // first, ensure the list is sorted by the contributor counts in descending order
  contribCounts.sort((a, b) => b.count - a.count);

  // get the total number of contributions in the timeframe window
  const total = contribCounts.reduce((sum, contrib) => sum + contrib.count, 0);

  /*
   * calculate the index at which 50% of commits are being made by top contributors.
   * this is done by iterating the list and denoting the index up until the
   * running total of contributions is > 50 % of contributions.
   */

  let cumulativeCount = 0;
  let i = 0;

  // eslint-disable-next-line no-loops/no-loops
  while (cumulativeCount < total * 0.5 && i < contribCounts.length) {
    cumulativeCount += contribCounts[i].count;
    i++;
  }

  let allLottoFactor = LotteryFactorEnum.LOW;

  // a sole contributor has over 50% of commits: Very high risk
  if (i >= 1) {
    allLottoFactor = LotteryFactorEnum.VERY_HIGH;
  }

  // two contributors have combined over 50% of contributions: High risk
  if (i >= 2) {
    allLottoFactor = LotteryFactorEnum.HIGH;
  }

  // 3-5 contributors combined have over 50% of contributions: Moderate risk
  if (i >= 3) {
    allLottoFactor = LotteryFactorEnum.MODERATE;
  }

  // over 5 contributors combined have over 50% of contributions: Low risk
  if (i >= 5) {
    allLottoFactor = LotteryFactorEnum.LOW;
  }

  /*
   * calculates the risk factor for individuals when compared to the total.
   * Any one person may have a large number of contributions which can be helpful
   * in understanding where individuals lie within a lottery factor index
   */

  contribCounts.map((contrib) => {
    contrib.percent_of_total = contrib.count / total;

    // the contributor has 10% or less of total contributions: Low risk
    if (contrib.percent_of_total <= 0.1) {
      contrib.lotto_factor = LotteryFactorEnum.LOW;
      return;
    }

    // the contributor has between 10-25% of total contributions: Moderate risk
    if (contrib.percent_of_total <= 0.25) {
      contrib.lotto_factor = LotteryFactorEnum.MODERATE;
      return;
    }

    // the contributor has between 25-50% of total contributions: High risk
    if (contrib.percent_of_total <= 0.5) {
      contrib.lotto_factor = LotteryFactorEnum.HIGH;
      return;
    }

    // the contributor has over 50% of total contributions: Very high risk
    contrib.lotto_factor = LotteryFactorEnum.VERY_HIGH;
  });

  result.all_contribs = contribCounts;
  result.all_lotto_factor = allLottoFactor;

  return result;
}
