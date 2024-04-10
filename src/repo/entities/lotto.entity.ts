import { ApiModelProperty } from "@nestjs/swagger/dist/decorators/api-model-property.decorator";
import { Type } from "class-transformer";
import { IsArray, IsEnum } from "class-validator";
import { Entity, Column } from "typeorm";
import { DbContributorCounts } from "../../timescale/entities/contributor_counts.entity";

export enum LotteryFactorEnum {
  LOW = "low",
  MODERATE = "moderate",
  HIGH = "high",
  VERY_HIGH = "very-high",
}

@Entity({ name: "pull_request_github_events" })
export class DbLotteryFactor {
  @ApiModelProperty({
    description: "",
    isArray: true,
    example: [],
  })
  @Column({
    select: false,
    insert: false,
  })
  @IsArray()
  @Type(() => DbContributorCounts)
  public all_contribs: DbContributorCounts[];

  @ApiModelProperty({
    description: "Lottery factor risk level for entire repo: one of low, moderate, high, very-high",
    example: "moderate",
  })
  @Column({
    select: false,
    insert: false,
  })
  @IsEnum(LotteryFactorEnum)
  public all_lotto_factor: LotteryFactorEnum;
}
