import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsIn, IsInt, IsOptional, IsString } from "class-validator";
import { Type } from "class-transformer";
import { InsightFilterFieldsEnum } from "../../insight/dtos/insight-options.dto";

import { RepoPageOptionsDto } from "./repo-page-options.dto";

export class RepoSearchOptionsDto extends RepoPageOptionsDto {
  @ApiPropertyOptional({
    enum: InsightFilterFieldsEnum,
    enumName: "InsightFilterFieldsEnum",
  })
  @IsEnum(InsightFilterFieldsEnum)
  @IsOptional()
  readonly filter?: InsightFilterFieldsEnum;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  readonly repo?: string;

  @ApiPropertyOptional({
    type: "string",
    default: "",
  })
  @IsString()
  @IsOptional()
  readonly topic?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  readonly repoIds?: string;
}

export class RepoRangeOptionsDto {
  @ApiProperty()
  @IsString()
  readonly repos: string;

  @ApiPropertyOptional({
    description: "Range in days",
    default: 30,
    type: "integer",
  })
  @Type(() => Number)
  @IsIn([7, 30, 90])
  @IsInt()
  @IsOptional()
  readonly range?: number = 30;

  @ApiPropertyOptional({
    description: "Number of days in the past to start range block",
    default: 0,
    type: "integer",
  })
  @Type(() => Number)
  @IsIn([0, 7, 30, 90])
  @IsInt()
  @IsOptional()
  readonly prev_days_start_date?: number = 0;
}

export class RepoFuzzySearchOptionsDto extends RepoPageOptionsDto {
  @ApiProperty()
  @IsString()
  readonly fuzzy_repo_name: string;

  @ApiPropertyOptional({
    type: "string",
    default: "",
  })
  @IsString()
  @IsOptional()
  readonly topic?: string;
}
