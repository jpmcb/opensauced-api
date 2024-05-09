import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString } from "class-validator";

export class ContributionsByProjectDto {
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
    description: "Repo, comma delimited names",
    type: "string",
    example: "open-sauced/app",
  })
  @Type(() => String)
  @IsString()
  @IsOptional()
  readonly repos?: string;
}
