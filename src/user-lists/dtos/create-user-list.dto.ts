import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsOptional, IsString } from "class-validator";

export class Contributor {
  id: number;
  login: string;
}

export class CreateUserListDto {
  @ApiProperty({
    description: "List Name",
    type: String,
    example: "My List",
  })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: "List Visibility",
    type: Boolean,
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  is_public?: boolean = true;

  @ApiProperty({
    description: "An array of contributor objects",
    isArray: true,
    example: [{ id: 12345, login: "sauceduser" }],
  })
  @IsArray()
  @Type(() => Contributor)
  contributors: { id: number; login: string }[];
}
