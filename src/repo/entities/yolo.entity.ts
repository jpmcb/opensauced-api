import { ApiModelProperty } from "@nestjs/swagger/dist/decorators/api-model-property.decorator";
import { Column } from "typeorm";

export class DbRepoYolo {
  @ApiModelProperty({
    description: "Number of yolo pushes",
    example: 10,
  })
  @Column({
    select: false,
    insert: false,
  })
  public num_yolo_pushes: number;

  @ApiModelProperty({
    description: "Number of commits in yolo pushes",
    example: 10,
  })
  @Column({
    select: false,
    insert: false,
  })
  public num_yolo_pushed_commits: number;

  @ApiModelProperty({
    description: "The histogram of yolo pushes and their associated metadata",
  })
  @Column({
    select: false,
    insert: false,
  })
  data: DbRepoYoloData[];
}

export class DbRepoYoloData {
  @ApiModelProperty({
    description: "",
    example: "",
  })
  @Column({
    select: false,
    insert: false,
  })
  public actor_login: string;

  @ApiModelProperty({
    description: "Timestamp representing when yolo push occured",
    example: "2022-08-28 22:04:29.000000",
  })
  @Column({
    select: false,
    insert: false,
  })
  public event_time: Date;

  @ApiModelProperty({
    description: "",
    example: "",
  })
  @Column({
    select: false,
    insert: false,
  })
  public sha: string;

  @ApiModelProperty({
    description: "The number of commits yolo pushed in event.",
    example: 4,
  })
  @Column({
    select: false,
    insert: false,
  })
  public push_num_commits: number;
}
