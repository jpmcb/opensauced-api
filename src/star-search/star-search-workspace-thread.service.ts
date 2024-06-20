import { Repository, SelectQueryBuilder } from "typeorm";
import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { PageOptionsDto } from "../common/dtos/page-options.dto";
import { PageDto } from "../common/dtos/page.dto";
import { PageMetaDto } from "../common/dtos/page-meta.dto";
import { DbStarSearchThreadHistory } from "./entities/thread-history.entity";
import { DbStarSearchThread } from "./entities/thread.entity";
import { DbStarSearchWorkspaceThread } from "./entities/worspace-thread.entity";
import { StarSearchThreadHistoryMoodEnum } from "./dtos/update-thread-history.dto";

@Injectable()
export class StarSearchWorkspaceThreadService {
  constructor(
    @InjectRepository(DbStarSearchThread, "ApiConnection")
    private starSearchThreadRepository: Repository<DbStarSearchThread>,
    @InjectRepository(DbStarSearchWorkspaceThread, "ApiConnection")
    private starSearchWorkspaceThreadRepository: Repository<DbStarSearchWorkspaceThread>,
    @InjectRepository(DbStarSearchThreadHistory, "ApiConnection")
    private starSearchThreadHistoryRepository: Repository<DbStarSearchThreadHistory>
  ) {}

  baseQueryBuilder(): SelectQueryBuilder<DbStarSearchThread> {
    return this.starSearchThreadRepository.createQueryBuilder("starsearch_threads");
  }

  async findThreadByIdForWorkspace({
    threadId,
    workspaceId,
  }: {
    threadId: string;
    workspaceId: string;
  }): Promise<DbStarSearchThread> {
    const queryBuilder = this.baseQueryBuilder();

    queryBuilder
      .leftJoin(
        "starsearch_threads.workspace_thread",
        "starsearch_threads_workspace_thread",
        "starsearch_threads.id = starsearch_threads_workspace_thread.starsearch_thread_id"
      )
      .where("starsearch_threads.id = :threadId", { threadId })
      .andWhere("starsearch_threads_workspace_thread.workspace_id = :workspaceId", { workspaceId });

    const thread: DbStarSearchThread | null = await queryBuilder.getOne();

    if (!thread) {
      throw new NotFoundException();
    }

    return thread;
  }

  async findThreadWithHistoryByIdForWorkspace({
    threadId,
    workspaceId,
  }: {
    threadId: string;
    workspaceId: string;
  }): Promise<DbStarSearchThread> {
    const queryBuilder = this.baseQueryBuilder();

    queryBuilder
      .leftJoin(
        "starsearch_threads.workspace_thread",
        "starsearch_threads_workspace_thread",
        "starsearch_threads.id = starsearch_threads_workspace_thread.starsearch_thread_id"
      )
      .leftJoinAndSelect(
        "starsearch_threads.thread_history",
        "starsearch_threads_history",
        "starsearch_threads.id = starsearch_threads_history.starsearch_thread_id"
      )
      .where("starsearch_threads.id = :threadId", { threadId })
      .andWhere("starsearch_threads_workspace_thread.workspace_id = :workspaceId", { workspaceId })
      .orderBy("starsearch_threads_history.created_at", "DESC");

    const thread: DbStarSearchThread | null = await queryBuilder.getOne();

    if (!thread) {
      throw new NotFoundException();
    }

    return thread;
  }

  async findHistoryByIdForWorkspaceInThread(
    id: string,
    threadId: string,
    workspaceId: string
  ): Promise<DbStarSearchThreadHistory> {
    const queryBuilder = this.starSearchThreadHistoryRepository.createQueryBuilder("starsearch_thread_history");

    queryBuilder
      .leftJoin(
        "starsearch_thread_history.thread",
        "starsearch_thread_history_thread",
        "starsearch_thread_history.starsearch_thread_id = starsearch_thread_history_thread.id"
      )
      .leftJoin(
        "starsearch_thread_history_thread.workspace_thread",
        "starsearch_thread_history_thread_workspace_thread",
        "starsearch_thread_history_thread.id = starsearch_thread_history_thread_workspace_thread.starsearch_thread_id"
      )
      .where("starsearch_thread_history.id = :id", { id })
      .andWhere("starsearch_thread_history_thread.id = :threadId", { threadId })
      .andWhere("starsearch_thread_history_thread_workspace_thread.workspace_id = :workspaceId", { workspaceId });

    const threadHistory: DbStarSearchThreadHistory | null = await queryBuilder.getOne();

    if (!threadHistory) {
      throw new NotFoundException();
    }

    return threadHistory;
  }

  async findWorkspaceThreads(
    pageOptionsDto: PageOptionsDto,
    workspaceId: string
  ): Promise<PageDto<DbStarSearchThread>> {
    const queryBuilder = this.baseQueryBuilder();

    queryBuilder.leftJoin("starsearch_threads.workspace_thread", "starsearch_threads_workspace_thread").where(
      `
      "starsearch_threads"."id" IN (
        SELECT "starsearch_thread_id" FROM "starsearch_workspace_threads" WHERE "workspace_id" = :workspaceId
      )`,
      { workspaceId }
    );

    queryBuilder.skip(pageOptionsDto.skip).take(pageOptionsDto.limit);
    queryBuilder.orderBy("starsearch_threads.updated_at", "DESC");

    const [itemCount, entities] = await Promise.all([queryBuilder.getCount(), queryBuilder.getMany()]);

    const pageMetaDto = new PageMetaDto({ itemCount, pageOptionsDto });

    return new PageDto(entities, pageMetaDto);
  }

  async createWorkspaceThread(workspaceId: string): Promise<DbStarSearchThread> {
    return this.starSearchWorkspaceThreadRepository.manager.transaction(async (entityManager) => {
      const newThread = entityManager.create(DbStarSearchThread, {
        title: "New StarSearch thread",
      });

      const savedThread = await entityManager.save(DbStarSearchThread, newThread);

      const newWorkspaceThread = entityManager.create(DbStarSearchWorkspaceThread, {
        workspace_id: workspaceId,
        starsearch_thread_id: savedThread.id,
      });

      await entityManager.save(DbStarSearchWorkspaceThread, newWorkspaceThread);

      return savedThread;
    });
  }

  async updateThreadByIdForWorkspace({
    threadId,
    workspaceId,
    threadSummary = "",
    title = "",
    isArchived = null,
  }: {
    threadId: string;
    workspaceId: string;
    threadSummary?: string;
    title?: string;
    isArchived?: boolean | null;
  }): Promise<DbStarSearchThread> {
    const thread = await this.findThreadByIdForWorkspace({ threadId, workspaceId });

    if (threadSummary) {
      thread.thread_summary = threadSummary;
    }

    if (title) {
      thread.title = title;
    }

    if (isArchived === true) {
      thread.archived_at = new Date();
    }

    if (isArchived === false) {
      thread.archived_at = null;
    }

    await this.starSearchThreadRepository.update(threadId, thread);

    return thread;
  }

  async updateThreadHistory({
    threadId,
    historyId,
    workspaceId,
    mood,
  }: {
    threadId: string;
    historyId: string;
    workspaceId: string;
    mood: StarSearchThreadHistoryMoodEnum;
  }): Promise<DbStarSearchThreadHistory> {
    const history = await this.findHistoryByIdForWorkspaceInThread(historyId, threadId, workspaceId);

    history.mood = mood;

    await this.starSearchThreadHistoryRepository.update(history.id, history);

    return history;
  }

  async deleteWorkspaceThread({ workspaceId, threadId }: { workspaceId: string; threadId: string }): Promise<void> {
    const thread = await this.findThreadByIdForWorkspace({ workspaceId, threadId });

    await this.starSearchThreadRepository.softDelete(thread.id);
  }
}
