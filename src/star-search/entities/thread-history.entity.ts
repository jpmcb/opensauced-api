import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  PrimaryColumn,
} from "typeorm";
import { ApiModelProperty } from "@nestjs/swagger/dist/decorators/api-model-property.decorator";
import { ApiHideProperty } from "@nestjs/swagger";
import { DbStarSearchThread } from "./thread.entity";

@Entity({ name: "starsearch_thread_history" })
export class DbStarSearchThreadHistory {
  @ApiModelProperty({
    description: "The primary UUID identifier for the StarSearch thread's history",
    example: "abc-123",
  })
  @PrimaryColumn()
  @PrimaryGeneratedColumn()
  public id!: string;

  @ApiModelProperty({
    description: "Timestamp representing thread history creation",
    example: "2022-10-19 13:24:51.000000",
  })
  @CreateDateColumn({
    type: "timestamp without time zone",
    default: () => "now()",
  })
  public created_at: Date;

  @ApiModelProperty({
    description: "Timestamp representing thread history last updated",
    example: "2022-10-19 13:24:51.000000",
  })
  @UpdateDateColumn({
    type: "timestamp without time zone",
    default: () => "now()",
  })
  public updated_at: Date;

  @ApiModelProperty({
    description: "Timestamp representing when the piece of thread history was sent in the SSE observer",
    example: "2022-10-19 13:24:51.000000",
  })
  @UpdateDateColumn({
    type: "timestamp without time zone",
  })
  public observed_at: Date | null;

  @ApiModelProperty({
    description: "Timestamp representing thread history deletion",
    example: "2022-10-19 13:24:51.000000",
  })
  @DeleteDateColumn({
    type: "timestamp without time zone",
  })
  public deleted_at: Date | null;

  @ApiModelProperty({
    description: "",
    example: "content",
  })
  @Column({
    type: "text",
    nullable: true,
  })
  public type: string | null;

  @ApiModelProperty({
    description: "",
    example: "{ ... }",
  })
  @Column({
    type: "text",
    nullable: true,
  })
  public message: string | null;

  @ApiModelProperty({
    description: "",
    example: false,
  })
  @Column({
    type: "boolean",
    default: false,
  })
  public is_error: boolean;

  @ApiModelProperty({
    description: "",
    example: "agent could not generate summary",
  })
  @Column({
    type: "text",
    nullable: true,
    default: null,
  })
  public error: string | null;

  @ApiModelProperty({
    description: "",
    example: "starsearch",
  })
  @Column({
    type: "text",
    nullable: true,
  })
  public actor: string | null;

  @ApiModelProperty({
    description: "",
    example: "starsearch",
  })
  @Column({
    type: "text",
  })
  public mood: number;

  @Column({
    /*
     * the pgvector "vector" type is unfortunately not directly supported by TypeORM right now:
     * https://github.com/typeorm/typeorm/issues/10056
     */
    type: "numeric",
    default: null,
    nullable: true,
    select: false,
  })
  public embedding: string | null;

  @ApiModelProperty({
    description: "StarSearch thread identifier",
    example: "abc-123",
  })
  @Column()
  public starsearch_thread_id!: string;

  @ApiHideProperty()
  @ManyToOne(() => DbStarSearchThread, (thread) => thread.thread_history, { onDelete: "CASCADE" })
  @JoinColumn({ name: "starsearch_thread_id", referencedColumnName: "id" })
  public thread: DbStarSearchThread;
}
