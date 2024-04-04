import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { PageOptionsDto } from "../../common/dtos/page-options.dto";
import { OrderDirectionEnum } from "../../common/constants/order-direction.constant";
import { BaseHistogramDto } from "./base.dto";

export class ReleaseHistogramDto extends BaseHistogramDto {}

export class ReleasesDto extends PageOptionsDto {
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
    description: "Filter releases on a given actor",
    type: "string",
    example: "bdougie",
  })
  @IsString()
  @IsOptional()
  readonly contributor?: string;

  @ApiPropertyOptional({
    description: "Filter out releases based on a given actor",
    type: "string",
    example: "github-actions",
  })
  @IsString()
  @IsOptional()
  readonly not_contributor?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  readonly repoIds?: string;

  @ApiPropertyOptional({
    enum: OrderDirectionEnum,
    enumName: "OrderDirectionEnum",
    default: OrderDirectionEnum.DESC,
  })
  @IsEnum(OrderDirectionEnum)
  @IsOptional()
  readonly orderDirection?: OrderDirectionEnum = OrderDirectionEnum.DESC;
}
