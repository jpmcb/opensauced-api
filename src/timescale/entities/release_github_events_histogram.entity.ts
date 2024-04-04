import { ApiModelProperty } from "@nestjs/swagger/dist/decorators/api-model-property.decorator";
import { Entity, Column } from "typeorm";

@Entity({ name: "release_github_events" })
export class DbReleaseGitHubEvent {
  @ApiModelProperty({
    description: "Title of release",
    example: "New release for library",
  })
  @Column({
    type: "string",
    select: false,
    insert: false,
  })
  public title: string;

  @ApiModelProperty({
    description: "Timestamp representing release date/time",
    example: "2022-08-28 22:04:29.000000",
  })
  @Column({
    type: "timestamp without time zone",
    select: false,
    insert: false,
  })
  public release_date_time: string;

  @ApiModelProperty({
    description: "Tag of release",
    example: "v1.2.4",
  })
  @Column({
    type: "string",
    select: false,
    insert: false,
  })
  public tag: string;

  @ApiModelProperty({
    description: "Commit target reference of release",
    example: "main",
  })
  @Column({
    type: "string",
    select: false,
    insert: false,
  })
  public target_ref: string;

  @ApiModelProperty({
    description: "If the release is a draft",
    example: true,
  })
  @Column({
    type: "boolean",
    select: false,
    insert: false,
  })
  public is_draft: boolean;

  @ApiModelProperty({
    description: "If the release is a pre-release",
    example: true,
  })
  @Column({
    type: "boolean",
    select: false,
    insert: false,
  })
  public is_pre_release: boolean;

  @ApiModelProperty({
    description: "Contributor who cut release",
    example: "bdougie",
  })
  @Column({
    type: "string",
    select: false,
    insert: false,
  })
  public releaser_login: string;
}

@Entity({ name: "release_github_events" })
export class DbReleaseGitHubEventsHistogram {
  @ApiModelProperty({
    description: "Timestamp representing histogram bucket day",
    example: "2022-08-28 22:04:29.000000",
  })
  @Column({
    type: "timestamp without time zone",
    select: false,
    insert: false,
  })
  public bucket: Date;

  @ApiModelProperty({
    description: "Number of all releases in day bucket",
    example: 4,
    type: "integer",
  })
  @Column({
    type: "integer",
    select: false,
    insert: false,
  })
  public all_releases: number;

  @ApiModelProperty({
    description: "Number of releases in day bucket",
    example: 4,
    type: "integer",
  })
  @Column({
    type: "integer",
    select: false,
    insert: false,
  })
  public releases: number;

  @ApiModelProperty({
    description: "Number of draft releases in day bucket",
    example: 4,
    type: "integer",
  })
  @Column({
    type: "integer",
    select: false,
    insert: false,
  })
  public draft_releases: number;

  @ApiModelProperty({
    description: "Number of pre releases in day bucket",
    example: 4,
    type: "integer",
  })
  @Column({
    type: "integer",
    select: false,
    insert: false,
  })
  public pre_releases: number;
}
