import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

import { Type } from "class-transformer";
import { PageOptionsDto } from "../../common/dtos/page-options.dto";

export class UserPrsDto extends PageOptionsDto {
  @ApiPropertyOptional({
    description: "Repo, comma delimited names",
    type: "string",
    example: "open-sauced/app",
  })
  @Type(() => String)
  @IsString()
  @IsOptional()
  readonly repos?: string;

  @ApiPropertyOptional({
    description: "Repo, comma delimited IDs",
    type: "string",
    example: "12345",
  })
  @Type(() => String)
  @IsString()
  @IsOptional()
  readonly repoIds?: string;
}
