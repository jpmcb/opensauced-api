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
import { DbWorkspace } from "../../workspace/entities/workspace.entity";
import { DbStarSearchThread } from "./thread.entity";

@Entity({ name: "starsearch_workspace_threads" })
export class DbStarSearchWorkspaceThread {
  @ApiModelProperty({
    description: "The primary identifier for the StarSearch workspace's thread",
    example: "abc-123",
  })
  @PrimaryColumn()
  @PrimaryGeneratedColumn()
  public id!: string;

  @ApiModelProperty({
    description: "Timestamp representing workspace thread creation",
    example: "2022-10-19 13:24:51.000000",
  })
  @CreateDateColumn({
    type: "timestamp without time zone",
    default: () => "now()",
  })
  public created_at: Date;

  @ApiModelProperty({
    description: "Timestamp representing workspace thread last updated",
    example: "2022-10-19 13:24:51.000000",
  })
  @UpdateDateColumn({
    type: "timestamp without time zone",
  })
  public updated_at: Date | null;

  @ApiModelProperty({
    description: "Timestamp representing workspace thread deletion",
    example: "2022-10-19 13:24:51.000000",
  })
  @DeleteDateColumn({
    type: "timestamp without time zone",
  })
  public deleted_at: Date | null;

  @ApiModelProperty({
    description: "Workspace identifier for StarSearch thread",
    example: "abc-123",
  })
  @Column()
  public workspace_id!: string;

  @ApiModelProperty({
    description: "StarSearch thread identifier",
    example: "abc-123",
  })
  @Column()
  public starsearch_thread_id!: string;

  @ApiHideProperty()
  @ManyToOne(() => DbWorkspace, (workspace) => workspace.starsearch_threads, { onDelete: "CASCADE" })
  @JoinColumn({ name: "workspace_id", referencedColumnName: "id" })
  public workspace: DbWorkspace;

  @ApiHideProperty()
  @OneToOne(() => DbStarSearchThread, (thread) => thread.workspace_thread, { onDelete: "CASCADE" })
  @JoinColumn({ name: "starsearch_thread_id", referencedColumnName: "id" })
  public thread: DbStarSearchThread;
}
