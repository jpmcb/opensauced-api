import { DbContributorCounts } from "../../timescale/entities/contributor_counts.entity";
import { LotteryFactorEnum } from "../entities/lotto.entity";
import { calculateLottoFactor } from "./lotto";

describe("calculateLottoFactor", () => {
  it("should assign VERY_HIGH risk if one contributor makes over 50% of commits", () => {
    const contribCounts: DbContributorCounts[] = [
      { contributor: "jpmcb", count: 600, percent_of_total: 0, lotto_factor: "" },
      { contributor: "nickytonline", count: 400, percent_of_total: 0, lotto_factor: "" },
    ];
    const result = calculateLottoFactor(contribCounts);

    expect(result.all_lotto_factor).toEqual(LotteryFactorEnum.VERY_HIGH);
    expect(result.all_contribs[0].lotto_factor).toEqual(LotteryFactorEnum.VERY_HIGH);
  });

  it("should assign HIGH risk if two contributors make over 50% of commits", () => {
    const contribCounts: DbContributorCounts[] = [
      { contributor: "jpmcb", count: 300, percent_of_total: 0, lotto_factor: "" },
      { contributor: "nickytonline", count: 300, percent_of_total: 0, lotto_factor: "" },
      { contributor: "bdougie", count: 400, percent_of_total: 0, lotto_factor: "" },
    ];
    const result = calculateLottoFactor(contribCounts);

    expect(result.all_lotto_factor).toEqual(LotteryFactorEnum.HIGH);
  });

  it("should assign MODERATE risk if 3 to 5 contributors make over 50% of commits", () => {
    const contribCounts: DbContributorCounts[] = [
      { contributor: "jpmcb", count: 200, percent_of_total: 0, lotto_factor: "" },
      { contributor: "nickytonline", count: 200, percent_of_total: 0, lotto_factor: "" },
      { contributor: "bdougie", count: 200, percent_of_total: 0, lotto_factor: "" },
      { contributor: "zeucapua", count: 200, percent_of_total: 0, lotto_factor: "" },
      { contributor: "brandonroberts", count: 200, percent_of_total: 0, lotto_factor: "" },
    ];
    const result = calculateLottoFactor(contribCounts);

    expect(result.all_lotto_factor).toEqual(LotteryFactorEnum.MODERATE);
  });

  it("should assign LOW risk if over 5 contributors make over 50% of commits", () => {
    const contribCounts: DbContributorCounts[] = [
      { contributor: "jpmcb", count: 100, percent_of_total: 0, lotto_factor: "" },
      { contributor: "nickytonline", count: 100, percent_of_total: 0, lotto_factor: "" },
      { contributor: "bdougie", count: 100, percent_of_total: 0, lotto_factor: "" },
      { contributor: "zeucapua", count: 100, percent_of_total: 0, lotto_factor: "" },
      { contributor: "brandonroberts", count: 100, percent_of_total: 0, lotto_factor: "" },
      { contributor: "bekahHW", count: 100, percent_of_total: 0, lotto_factor: "" },
      { contributor: "takanome-dev", count: 100, percent_of_total: 0, lotto_factor: "" },
      { contributor: "isabensusan", count: 100, percent_of_total: 0, lotto_factor: "" },
      { contributor: "OgDev-01", count: 100, percent_of_total: 0, lotto_factor: "" },
      { contributor: "manipanditk", count: 100, percent_of_total: 0, lotto_factor: "" },
    ];
    const result = calculateLottoFactor(contribCounts);

    expect(result.all_lotto_factor).toEqual(LotteryFactorEnum.LOW);
  });

  it("should correctly calculate individual lotto factors based on contribution percentages", () => {
    const contribCounts: DbContributorCounts[] = [
      { contributor: "jpmcb", count: 49, percent_of_total: 0, lotto_factor: "" },
      { contributor: "nickytonline", count: 150, percent_of_total: 0, lotto_factor: "" },
      { contributor: "bdougie", count: 300, percent_of_total: 0, lotto_factor: "" },
      { contributor: "zeucapua", count: 501, percent_of_total: 0, lotto_factor: "" },
    ];

    const result = calculateLottoFactor(contribCounts);

    expect(result.all_contribs[3].lotto_factor).toEqual(LotteryFactorEnum.LOW);
    expect(result.all_contribs[2].lotto_factor).toEqual(LotteryFactorEnum.MODERATE);
    expect(result.all_contribs[1].lotto_factor).toEqual(LotteryFactorEnum.HIGH);
    expect(result.all_contribs[0].lotto_factor).toEqual(LotteryFactorEnum.VERY_HIGH);
  });
});
