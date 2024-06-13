import { IsOptional, IsString } from "class-validator";

export class UpdateThreadDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  threadSummary?: string;
}
