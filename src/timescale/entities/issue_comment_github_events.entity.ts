import {
  ApiModelProperty,
  ApiModelPropertyOptional,
} from "@nestjs/swagger/dist/decorators/api-model-property.decorator";
import { Entity, Column, BaseEntity, PrimaryColumn, CreateDateColumn } from "typeorm";

@Entity({ name: "issue_comment_github_events" })
export class DbIssueCommentGitHubEvents extends BaseEntity {
  @ApiModelProperty({
    description: "Issue comment event identifier",
    example: 1045024650,
    type: "integer",
  })
  @PrimaryColumn("integer")
  event_id: number;

  @ApiModelProperty({
    description: "Issue comment actor username",
    example: "Th3nn3ss",
  })
  @Column("text")
  public actor_login: string;

  @ApiModelPropertyOptional({
    description: "Timestamp representing time of issue comment",
    example: "2022-08-28 22:04:29.000000",
  })
  @CreateDateColumn({
    type: "timestamp without time zone",
    default: () => "now()",
  })
  public event_time: Date;

  @ApiModelProperty({
    description: "Repo full name where issue comment occurred",
    example: "open-sauced/app",
  })
  @Column({
    type: "text",
  })
  public repo_name: string;

  @ApiModelProperty({
    description: "Issue comment body",
    example: "This is a comment on an issue.",
  })
  @Column({
    type: "text",
    select: false,
  })
  public comment_body: string;

  @ApiModelProperty({
    description: "Issue comment URL",
    example: "https://github.com/open-sauced/insights/issues/1245#issuecomment-1583293314",
  })
  @Column({
    type: "text",
    select: false,
  })
  public comment_html_url: string;
}
