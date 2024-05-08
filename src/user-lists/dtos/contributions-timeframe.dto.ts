import { IsEnum, IsIn, IsInt, IsOptional, IsString } from "class-validator";

import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ContributorStatsTypeEnum } from "../../timescale/dtos/most-active-contrib.dto";

export class ContributionsTimeframeDto {
  @ApiPropertyOptional({
    description: "Range in days",
    default: 30,
    type: "integer",
  })
  @Type(() => Number)
  @IsIn([7, 30, 90, 180, 360])
  @IsInt()
  @IsOptional()
  readonly range?: number = 30;

  @ApiPropertyOptional({
    enum: ContributorStatsTypeEnum,
    enumName: "ContributorStatsTypeEnum",
    default: ContributorStatsTypeEnum.all,
  })
  @IsEnum(ContributorStatsTypeEnum)
  @IsOptional()
  contributorType?: ContributorStatsTypeEnum = ContributorStatsTypeEnum.all;

  @ApiPropertyOptional({
    description: "Repo, comma delimited names",
    type: "string",
    example: "open-sauced/app",
  })
  @Type(() => String)
  @IsString()
  @IsOptional()
  readonly repos?: string;
}
