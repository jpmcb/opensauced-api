import { IsEnum, IsNumber, IsOptional } from "class-validator";

export enum StarSearchThreadHistoryMoodEnum {
  positive = 1,
  neutral = 0,
  negative = -1,
}

export class UpdateStarSearchThreadHistoryDto {
  @IsNumber()
  @IsOptional()
  @IsEnum(StarSearchThreadHistoryMoodEnum)
  mood?: number;
}
