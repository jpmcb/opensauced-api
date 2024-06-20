import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { Type } from "class-transformer";
import { InsightFilterFieldsEnum } from "../../insight/dtos/insight-options.dto";

import { OrderDirectionEnum } from "../../common/constants/order-direction.constant";
import { RepoOrderFieldsEnum, RepoPageOptionsDto } from "./repo-page-options.dto";

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

export class RepoRangeOnlyOptionDto {
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
  @IsIn([7, 30, 90, 180, 360])
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

export class RepoFuzzySearchOptionsDto {
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

  @ApiPropertyOptional({
    enum: RepoOrderFieldsEnum,
    enumName: "RepoOrderFieldsEnum",
    default: RepoOrderFieldsEnum.stars,
  })
  @IsEnum(RepoOrderFieldsEnum)
  @IsOptional()
  readonly orderBy?: RepoOrderFieldsEnum = RepoOrderFieldsEnum.stars;

  @ApiPropertyOptional({
    minimum: 1,
    default: 1,
    type: "integer",
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  readonly page?: number = 1;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 1000,
    default: 10,
    type: "integer",
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  @IsOptional()
  readonly limit?: number = 50;

  @ApiPropertyOptional({ enum: OrderDirectionEnum, enumName: "OrderDirectionEnum", default: OrderDirectionEnum.DESC })
  @IsEnum(OrderDirectionEnum)
  @IsOptional()
  readonly orderDirection?: OrderDirectionEnum = OrderDirectionEnum.DESC;

  get skip(): number {
    return ((this.page ?? 1) - 1) * (this.limit ?? 50);
  }
}
