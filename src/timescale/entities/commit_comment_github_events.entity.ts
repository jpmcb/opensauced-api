import {
  ApiModelProperty,
  ApiModelPropertyOptional,
} from "@nestjs/swagger/dist/decorators/api-model-property.decorator";
import { Entity, Column, BaseEntity, PrimaryColumn, CreateDateColumn } from "typeorm";

@Entity({ name: "commit_comment_github_events" })
export class DbCommitCommentGitHubEvents extends BaseEntity {
  @ApiModelProperty({
    description: "Commit comment event identifier",
    example: 1045024650,
    type: "integer",
  })
  @PrimaryColumn("integer")
  event_id: number;

  @ApiModelProperty({
    description: "Commit comment actor username",
    example: "Th3nn3ss",
  })
  @Column("text")
  public actor_login: string;

  @ApiModelPropertyOptional({
    description: "Timestamp representing time of commit comment",
    example: "2022-08-28 22:04:29.000000",
  })
  @CreateDateColumn({
    type: "timestamp without time zone",
    default: () => "now()",
  })
  public event_time: Date;

  @ApiModelProperty({
    description: "Repo full name where the commit comment occured",
    example: "open-sauced/app",
  })
  @Column({
    type: "text",
  })
  public repo_name: string;
}
