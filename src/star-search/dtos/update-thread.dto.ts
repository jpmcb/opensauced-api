import { IsBoolean, IsOptional, IsString } from "class-validator";

export class UpdateStarSearchThreadDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsBoolean()
  archive?: boolean;
}
