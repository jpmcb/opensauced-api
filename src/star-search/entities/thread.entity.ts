import { ApiHideProperty } from "@nestjs/swagger";
import { ApiModelProperty } from "@nestjs/swagger/dist/decorators/api-model-property.decorator";
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  PrimaryColumn,
  OneToMany,
  OneToOne,
} from "typeorm";
import { DbStarSearchUserThread } from "./user-thread.entity";
import { DbStarSearchThreadHistory } from "./thread-history.entity";
import { DbStarSearchWorkspaceThread } from "./worspace-thread.entity";

@Entity({ name: "starsearch_threads" })
export class DbStarSearchThread {
  @ApiModelProperty({
    description: "The primary UUID identifier for the StarSearch thread",
    example: "abc-123",
  })
  @PrimaryColumn()
  @PrimaryGeneratedColumn()
  public id!: string;

  @ApiModelProperty({
    description: "Timestamp representing thread creation",
    example: "2022-10-19 13:24:51.000000",
  })
  @CreateDateColumn({
    type: "timestamp without time zone",
    default: () => "now()",
  })
  public created_at: Date;

  @ApiModelProperty({
    description: "Timestamp representing thread last updated",
    example: "2022-10-19 13:24:51.000000",
  })
  @UpdateDateColumn({
    type: "timestamp without time zone",
    default: () => "now()",
  })
  public updated_at: Date;

  @ApiModelProperty({
    description: "Timestamp representing thread archived",
    example: "2022-10-19 13:24:51.000000",
  })
  @Column({
    type: "timestamp without time zone",
  })
  public archived_at: Date | null;

  @ApiModelProperty({
    description: "Timestamp representing thread deletion",
    example: "2022-10-19 13:24:51.000000",
  })
  @DeleteDateColumn({
    type: "timestamp without time zone",
  })
  public deleted_at: Date | null;

  @ApiModelProperty({
    description: "The shortlink to the StarSearch thread",
    example: "https://oss.fyi/CJeemVC",
  })
  @Column({
    type: "text",
    nullable: true,
    default: null,
  })
  public public_link: string | null;

  @ApiModelProperty({
    description: "Boolean denoting if the StarSearch thread is publiclly viewable",
    example: false,
  })
  @Column({
    type: "boolean",
    default: false,
  })
  public is_publicly_viewable: boolean;

  @ApiModelProperty({
    description: "AI generated title for thread",
    example: "Best Rust and Tailwind developers",
  })
  @Column({
    type: "varchar",
    length: 255,
    nullable: true,
    default: null,
  })
  public title: string | null;

  @ApiModelProperty({
    description: "An AI generated summary of the entire thread history",
    example: "The user asked about the best rust and tailwind developers. StarSearch responded with ...",
  })
  @Column({
    type: "text",
    nullable: true,
    default: null,
  })
  public thread_summary: string | null;

  @ApiHideProperty()
  @OneToOne(() => DbStarSearchUserThread, (userThread) => userThread.thread, { onDelete: "CASCADE" })
  public user_thread: DbStarSearchUserThread;

  @ApiHideProperty()
  @OneToOne(() => DbStarSearchWorkspaceThread, (workspaceThread) => workspaceThread.thread, { onDelete: "CASCADE" })
  public workspace_thread: DbStarSearchWorkspaceThread;

  @ApiHideProperty()
  @OneToMany(() => DbStarSearchThreadHistory, (history) => history.thread, { onDelete: "CASCADE" })
  public thread_history: DbStarSearchThreadHistory[];
}
