import { Repository, SelectQueryBuilder } from "typeorm";
import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DbStarSearchThread } from "./entities/thread.entity";
import { DbStarSearchThreadHistory } from "./entities/thread-history.entity";
import { StarSearchThreadHistoryMoodEnum } from "./dtos/update-thread-history.dto";

@Injectable()
export class StarSearchThreadService {
  constructor(
    @InjectRepository(DbStarSearchThread, "ApiConnection")
    private starSearchThreadRepository: Repository<DbStarSearchThread>,
    @InjectRepository(DbStarSearchThreadHistory, "ApiConnection")
    private starSearchThreadHistoryRepository: Repository<DbStarSearchThreadHistory>
  ) {}

  baseQueryBuilder(): SelectQueryBuilder<DbStarSearchThread> {
    return this.starSearchThreadRepository.createQueryBuilder("starsearch_threads");
  }

  async findThreadById(id: string): Promise<DbStarSearchThread> {
    const thread = await this.starSearchThreadRepository.findOne({
      where: {
        id,
      },
    });

    if (!thread) {
      throw new NotFoundException();
    }

    return thread;
  }

  async findHistoryById(id: string): Promise<DbStarSearchThreadHistory> {
    const threadHistory = await this.starSearchThreadHistoryRepository.findOne({
      where: {
        id,
      },
    });

    if (!threadHistory) {
      throw new NotFoundException();
    }

    return threadHistory;
  }

  async findHistoryByIdInThread({
    historyId,
    threadId,
  }: {
    historyId: string;
    threadId: string;
  }): Promise<DbStarSearchThreadHistory> {
    const queryBuilder = this.starSearchThreadHistoryRepository.createQueryBuilder("starsearch_thread_history");

    queryBuilder
      .leftJoin(
        "starsearch_thread_history.thread",
        "starsearch_thread_history_thread",
        "starsearch_thread_history.starsearch_thread_id = starsearch_thread_history_thread.id"
      )
      .where("starsearch_thread_history.id = :historyId", { historyId })
      .andWhere("starsearch_thread_history_thread.id = :threadId", { threadId });

    const threadHistory: DbStarSearchThreadHistory | null = await queryBuilder.getOne();

    if (!threadHistory) {
      throw new NotFoundException();
    }

    return threadHistory;
  }

  async updateThreadById({
    threadId,
    threadSummary = "",
    title = "",
    isArchived = null,
  }: {
    threadId: string;
    threadSummary?: string;
    title?: string;
    isArchived?: boolean | null;
  }): Promise<DbStarSearchThread> {
    const thread = await this.findThreadById(threadId);

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
    mood,
  }: {
    threadId: string;
    historyId: string;
    mood: StarSearchThreadHistoryMoodEnum;
  }): Promise<DbStarSearchThreadHistory> {
    const history = await this.findHistoryByIdInThread({ historyId, threadId });

    history.mood = mood;

    await this.starSearchThreadHistoryRepository.update(history.id, history);

    return history;
  }

  async newThreadHistory(threadId: string): Promise<DbStarSearchThreadHistory> {
    return this.starSearchThreadHistoryRepository.save({
      starsearch_thread_id: threadId,
    });
  }

  async addToThreadHistory({
    id,
    type,
    message,
    is_error = false,
    error,
    actor,
    embedding,
  }: {
    id: string;
    type: string;
    message: string;
    is_error?: boolean;
    error?: string;
    actor: string;
    embedding?: number[];
  }): Promise<DbStarSearchThreadHistory> {
    const threadHistory: Partial<DbStarSearchThreadHistory> = {
      observed_at: new Date(),
      type,
      message,
      is_error,
      error,
      actor,
      embedding: embedding ? `[${embedding.join(",")}]` : null,
    };

    await this.starSearchThreadHistoryRepository.update(id, threadHistory);

    return this.findHistoryById(id);
  }
}
