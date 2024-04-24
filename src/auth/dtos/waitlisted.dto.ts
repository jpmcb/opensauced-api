import { ApiProperty } from "@nestjs/swagger";

export class WaitlistedUsersDto {
  @ApiProperty({
    description: "",
    example: 10,
    type: "integer",
  })
  users_waitlisted: number;
}
