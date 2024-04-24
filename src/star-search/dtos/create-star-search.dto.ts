import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class StarSearchStreamDto {
  @ApiProperty({
    description: "Query text",
    type: String,
  })
  @IsString()
  query_text: string;
}
