import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBooleanString, IsEnum, IsOptional, IsString } from "class-validator";

import { PageOptionsDto } from "../../common/dtos/page-options.dto";
import { IssueOrderFieldsEnum, IssueStatusEnum } from "../../pull-requests/dtos/issue-page-options.dto";

export class WorkspaceRepoIssuePageOptionsDto extends PageOptionsDto {
  @ApiPropertyOptional({
    enum: IssueOrderFieldsEnum,
    enumName: "IssueOrderFieldsEnum",
    default: IssueOrderFieldsEnum.updated_at,
  })
  @IsEnum(IssueOrderFieldsEnum)
  @IsOptional()
  readonly orderBy?: IssueOrderFieldsEnum = IssueOrderFieldsEnum.updated_at;

  @ApiPropertyOptional({
    type: "string",
    example: "12345,98765",
    description: "A comma delimited list of repo IDs to filter out of the workspace repo PRs list",
  })
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
    example: "true",
  })
  @IsBooleanString()
  @IsOptional()
  readonly distinctAuthors?: string = "false";
}
