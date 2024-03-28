import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsOptional, IsString } from "class-validator";

import { RepoInfo } from "../../repo/dtos/repo-info.dto";

export class CreateInsightDto {
  @ApiProperty({
    description: "Insight Page Name",
    type: String,
    example: "My Team",
  })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: "Insight Page Visibility",
    type: Boolean,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  is_public?: boolean = true;

  @ApiProperty({
    description: "An array of repository information objects",
    isArray: true,
    type: RepoInfo,
    example: [{ id: 797, fullName: "open-sauced/insights" }],
  })
  @Type(() => RepoInfo)
  @IsArray()
  repos: RepoInfo[];
}
