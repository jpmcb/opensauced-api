import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBooleanString, IsEnum, IsOptional, IsString } from "class-validator";

import { PageOptionsDto } from "../../common/dtos/page-options.dto";
import { InsightFilterFieldsEnum } from "../../insight/dtos/insight-options.dto";

export enum IssueOrderFieldsEnum {
  created_at = "created_at",
  closed_at = "closed_at",
  updated_at = "updated_at",
  reactions_heart = "reactions_heart",
}

export enum IssueStatusEnum {
  open = "open",
  closed = "closed",
  reopened = "reopened",
}

export class IssuePageOptionsDto extends PageOptionsDto {
  @ApiPropertyOptional({
    enum: IssueOrderFieldsEnum,
    enumName: "IssueOrderFieldsEnum",
    default: IssueOrderFieldsEnum.updated_at,
  })
  @IsEnum(IssueOrderFieldsEnum)
  @IsOptional()
  readonly orderBy?: IssueOrderFieldsEnum = IssueOrderFieldsEnum.updated_at;

  @ApiPropertyOptional({
    enum: InsightFilterFieldsEnum,
    enumName: "InsightFilterFieldsEnum",
  })
  @IsEnum(InsightFilterFieldsEnum)
  @IsOptional()
  readonly filter?: InsightFilterFieldsEnum;

  @ApiPropertyOptional({
    type: "string",
    example: "javascript",
  })
  @IsString()
  @IsOptional()
  readonly topic?: string;

  @ApiPropertyOptional({
    type: "string",
    example: "open-sauced/insights",
  })
  @IsString()
  @IsOptional()
  readonly repo?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  readonly repoIds?: string;

  @ApiPropertyOptional({
    enum: IssueStatusEnum,
    enumName: "IssueStatusEnum",
  })
  @IsEnum(IssueStatusEnum)
  @IsOptional()
  readonly status?: IssueStatusEnum;

  @ApiPropertyOptional({
    type: "string",
    example: "bdougie",
  })
  @IsString()
  @IsOptional()
  readonly contributor?: string;

  @ApiPropertyOptional({
    type: "string",
    example: "uuid-v4",
  })
  @IsString()
  @IsOptional()
  readonly listId?: string;

  @ApiPropertyOptional({
    example: "true",
  })
  @IsBooleanString()
  @IsOptional()
  readonly distinctAuthors?: string = "false";
}
