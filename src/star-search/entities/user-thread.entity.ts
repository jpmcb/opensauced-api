import {
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  PrimaryColumn,
  Column,
  OneToOne,
} from "typeorm";
import { ApiModelProperty } from "@nestjs/swagger/dist/decorators/api-model-property.decorator";
import { ApiHideProperty } from "@nestjs/swagger";
import { DbUser } from "../../user/user.entity";
import { DbStarSearchThread } from "./thread.entity";

@Entity({ name: "starsearch_user_threads" })
export class DbStarSearchUserThread {
  @ApiModelProperty({
    description: "The primary identifier for the StarSearch user's thread",
    example: "abc-123",
  })
  @PrimaryColumn()
  @PrimaryGeneratedColumn()
  public id!: string;

  @ApiModelProperty({
    description: "Timestamp representing user thread creation",
    example: "2022-10-19 13:24:51.000000",
  })
  @CreateDateColumn({
    type: "timestamp without time zone",
    default: () => "now()",
  })
  public created_at: Date;

  @ApiModelProperty({
    description: "Timestamp representing user thread last updated",
    example: "2022-10-19 13:24:51.000000",
  })
  @UpdateDateColumn({
    type: "timestamp without time zone",
  })
  public updated_at: Date | null;

  @ApiModelProperty({
    description: "Timestamp representing user thread deletion",
    example: "2022-10-19 13:24:51.000000",
  })
  @DeleteDateColumn({
    type: "timestamp without time zone",
  })
  public deleted_at: Date | null;

  @ApiModelProperty({
    description: "User identifier for StarSearch thread",
    example: 237133,
    type: "integer",
  })
  @Column()
  public user_id!: number;

  @ApiModelProperty({
    description: "StarSearch thread identifier",
    example: "abc-123",
  })
  @Column()
  public starsearch_thread_id!: string;

  @ApiHideProperty()
  @ManyToOne(() => DbUser, (user) => user.starsearch_thread, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id", referencedColumnName: "id" })
  public user: DbUser;

  @ApiHideProperty()
  @OneToOne(() => DbStarSearchThread, (thread) => thread.user_thread, { onDelete: "CASCADE" })
  @JoinColumn({ name: "starsearch_thread_id", referencedColumnName: "id" })
  public thread: DbStarSearchThread;
}
