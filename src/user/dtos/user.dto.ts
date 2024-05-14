import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsString, IsOptional } from "class-validator";

export class UserDto {
  @ApiPropertyOptional({
    description: "Repository IDs, comma delimited",
    type: "string",
    example: "501028599",
  })
  @Type(() => String)
  @IsString()
  @IsOptional()
  readonly maintainerRepoIds?: string;
}
