import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString } from "class-validator";

export class TopProjectsDto {
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

  @ApiProperty({
    description: "Repo, comma delimited names",
    type: "string",
    example: "open-sauced/app",
  })
  @Type(() => String)
  @IsString()
  readonly repos: string;
}
