import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBooleanString, IsEnum, IsOptional, IsString } from "class-validator";

import { PageOptionsDto } from "../../common/dtos/page-options.dto";
import {
  PullRequestOrderFieldsEnum,
  PullRequestStatusEnum,
} from "../../pull-requests/dtos/pull-request-page-options.dto";

export class WorkspaceRepoPullRequestPageOptionsDto extends PageOptionsDto {
  @ApiPropertyOptional({
    enum: PullRequestOrderFieldsEnum,
    enumName: "PullRequestOrderFieldsEnum",
    default: PullRequestOrderFieldsEnum.updated_at,
  })
  @IsEnum(PullRequestOrderFieldsEnum)
  @IsOptional()
  readonly orderBy?: PullRequestOrderFieldsEnum = PullRequestOrderFieldsEnum.updated_at;

  @ApiPropertyOptional({
    type: "string",
    example: "12345,98765",
    description: "A comma delimited list of repo IDs to filter out of the workspace repo PRs list",
  })
  @IsString()
  @IsOptional()
  readonly repoIds?: string;

  @ApiPropertyOptional({
    enum: PullRequestStatusEnum,
    enumName: "PullRequestStatusEnum",
  })
  @IsEnum(PullRequestStatusEnum)
  @IsOptional()
  readonly status?: PullRequestStatusEnum;

  @ApiPropertyOptional({
    type: "string",
    example: "bdougie",
  })
  @IsString()
  @IsOptional()
  readonly contributor?: string;

  @ApiPropertyOptional({
    example: "true",
  })
  @IsBooleanString()
  @IsOptional()
  readonly distinctAuthors?: string = "false";
}
