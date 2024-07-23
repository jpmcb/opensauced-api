import { Column, Entity } from "typeorm";
import { ApiModelProperty } from "@nestjs/swagger/dist/decorators/api-model-property.decorator";

@Entity({ name: "pull_request_github_events" })
export class DbRepoContributor {
  @ApiModelProperty({
    description: "Repo contributor login id",
    example: 12345,
  })
  @Column({
    type: "bigint",
    select: false,
    insert: false,
  })
  id: number;

  @ApiModelProperty({
    description: "Repo contributor login",
    example: "bdougie",
  })
  @Column({
    type: "text",
    select: false,
    insert: false,
  })
  login: string;

  @ApiModelProperty({
    description: "Repo contributor avatar URL",
  })
  @Column({
    type: "text",
    select: false,
    insert: false,
  })
  avatar_url: string;

  @ApiModelProperty({
    description: "Repo contributor's company",
  })
  @Column({
    type: "text",
    select: false,
    insert: false,
  })
  company: string;

  @ApiModelProperty({
    description: "Repo contributor's location",
  })
  @Column({
    type: "text",
    select: false,
    insert: false,
  })
  location: string;

  @ApiModelProperty({
    description: "Repo contributor's Open Source Contributor Rating",
    example: 0.87,
  })
  @Column({
    type: "float",
    default: 0,
    select: false,
    insert: false,
  })
  oscr: number;

  @ApiModelProperty({
    description: "The repo contributor's top repos they contribute to",
    type: "string",
    isArray: true,
    example: ["open-sauced/app", "kubernetes/kubernetes"],
  })
  @Column({
    type: "string",
    select: false,
    insert: false,
  })
  repos: string[];

  @ApiModelProperty({
    description: "The repo contributor's tags",
    type: "string",
    isArray: true,
    example: ["yolo", "internal"],
  })
  @Column({
    type: "string",
    select: false,
    insert: false,
  })
  tags: string[];

  @ApiModelProperty({
    description: "Number of commits for login in repo within the time range",
    example: 0,
    type: "integer",
  })
  @Column({
    type: "bigint",
    select: false,
    insert: false,
  })
  commits: number;

  @ApiModelProperty({
    description: "Number of PRs created for login in repo within the time range",
    example: 0,
    type: "integer",
  })
  @Column({
    type: "bigint",
    select: false,
    insert: false,
  })
  prs_created: number;

  @ApiModelProperty({
    description: "Number of PRs reviewed for login in repo within the time range",
    example: 0,
    type: "integer",
  })
  @Column({
    type: "bigint",
    select: false,
    insert: false,
  })
  prs_reviewed: number;

  @ApiModelProperty({
    description: "Number of issues created for login in repo within the time range",
    example: 0,
    type: "integer",
  })
  @Column({
    type: "bigint",
    select: false,
    insert: false,
  })
  issues_created: number;

  @ApiModelProperty({
    description: "Number of commit comments for login in repo within the time range",
    example: 0,
    type: "integer",
  })
  @Column({
    type: "bigint",
    select: false,
    insert: false,
  })
  commit_comments: number;

  @ApiModelProperty({
    description: "Number of issue comments for login in repo within the time range",
    example: 0,
    type: "integer",
  })
  @Column({
    type: "bigint",
    select: false,
    insert: false,
  })
  issue_comments: number;

  @ApiModelProperty({
    description: "Number of pr review comments for login in repo within the time range",
    example: 0,
    type: "integer",
  })
  @Column({
    type: "bigint",
    select: false,
    insert: false,
  })
  pr_review_comments: number;

  @ApiModelProperty({
    description: "Number of total comments for login in repo within the time range",
    example: 0,
    type: "integer",
  })
  @Column({
    type: "bigint",
    select: false,
    insert: false,
  })
  comments: number;

  @ApiModelProperty({
    description: "Number of total contributions for a login in repo within the time range",
    example: 0,
    type: "integer",
  })
  @Column({
    type: "bigint",
    select: false,
    insert: false,
  })
  total_contributions: number;

  @ApiModelProperty({
    description: "Timestamp representing when the repo contributor last contributed",
    example: "2022-08-28 22:04:29.000000",
  })
  @Column({
    type: "timestamp without time zone",
    select: false,
    insert: false,
  })
  public last_contributed: Date;
}
