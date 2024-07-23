import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import { PageOptionsDto } from "../../common/dtos/page-options.dto";

export enum RepoContributorFilterFieldsEnum {
  OSCR = "oscr",
}

export class RepoContributorsDto extends PageOptionsDto {
  @ApiPropertyOptional({
    enum: RepoContributorFilterFieldsEnum,
    enumName: "RepoContributorFilterFieldsEnum",
    default: RepoContributorFilterFieldsEnum.OSCR,
  })
  @IsEnum(RepoContributorFilterFieldsEnum)
  @IsOptional()
  readonly filter?: RepoContributorFilterFieldsEnum = RepoContributorFilterFieldsEnum.OSCR;
}
