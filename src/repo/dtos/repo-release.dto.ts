import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { PageOptionsDto } from "../../common/dtos/page-options.dto";

export class RepoReleaseDto extends PageOptionsDto {
  @ApiPropertyOptional({
    description: "Filter for contributor who cut release",
    type: String,
    example: "bdougie",
  })
  @IsString()
  @IsOptional()
  contributor?: string;

  @ApiPropertyOptional({
    description: "Filter out contributor who cut release",
    type: String,
    example: "bdougie",
  })
  @IsString()
  @IsOptional()
  not_contributor?: string;
}
