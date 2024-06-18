import { Brackets, Repository, SelectQueryBuilder } from "typeorm";
import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { PageMetaDto } from "../common/dtos/page-meta.dto";
import { PageDto } from "../common/dtos/page.dto";
import { PageOptionsDto } from "../common/dtos/page-options.dto";
import { UrlShortenerService } from "../url/url-shortener.service";
import { DbStarSearchThread } from "./entities/thread.entity";
import { DbStarSearchUserThread } from "./entities/user-thread.entity";
import { DbStarSearchThreadHistory } from "./entities/thread-history.entity";
import { StarSearchThreadHistoryMoodEnum } from "./dtos/update-thread-history.dto";

@Injectable()
export class StarSearchThreadService {
  constructor(
    private readonly configService: ConfigService,
    private urlShortenerService: UrlShortenerService,
    @InjectRepository(DbStarSearchThread, "ApiConnection")
    private starSearchThreadRepository: Repository<DbStarSearchThread>,
    @InjectRepository(DbStarSearchUserThread, "ApiConnection")
    private starSearchUserThreadRepository: Repository<DbStarSearchUserThread>,
    @InjectRepository(DbStarSearchThreadHistory, "ApiConnection")
    private starSearchThreadHistoryRepository: Repository<DbStarSearchThreadHistory>
  ) {}

  baseQueryBuilder(): SelectQueryBuilder<DbStarSearchThread> {
    return this.starSearchThreadRepository.createQueryBuilder("starsearch_threads");
  }

  async findThreadByIdForUser(id: string, userId: number): Promise<DbStarSearchThread> {
    const queryBuilder = this.baseQueryBuilder();

    queryBuilder
      .leftJoin(
        "starsearch_threads.user_thread",
        "starsearch_threads_user_thread",
        "starsearch_threads.id = starsearch_threads_user_thread.starsearch_thread_id"
      )
      .where("starsearch_threads.id = :id", { id })
      .andWhere("starsearch_threads_user_thread.user_id = :userId", { userId });

    const thread: DbStarSearchThread | null = await queryBuilder.getOne();

    if (!thread) {
      throw new NotFoundException();
    }

    return thread;
  }

  async findThreadWithHistoryByIdForUser(id: string, userId: number): Promise<DbStarSearchThread> {
    const queryBuilder = this.baseQueryBuilder();

    queryBuilder
      .leftJoin(
        "starsearch_threads.user_thread",
        "starsearch_threads_user_thread",
        "starsearch_threads.id = starsearch_threads_user_thread.starsearch_thread_id"
      )
      .leftJoinAndSelect(
        "starsearch_threads.thread_history",
        "starsearch_threads_history",
        "starsearch_threads.id = starsearch_threads_history.starsearch_thread_id"
      )
      .where("starsearch_threads.id = :id", { id })
      .andWhere("starsearch_threads_user_thread.user_id = :userId", { userId })
      .orderBy("starsearch_threads_history.observed_at", "ASC");

    const thread: DbStarSearchThread | null = await queryBuilder.getOne();

    if (!thread) {
      throw new NotFoundException();
    }

    return thread;
  }

  async findPublicThreadWithHistoryByIdForUser(id: string, userId: number | undefined): Promise<DbStarSearchThread> {
    const queryBuilder = this.baseQueryBuilder();

    queryBuilder
      .leftJoin(
        "starsearch_threads.user_thread",
        "starsearch_threads_user_thread",
        "starsearch_threads.id = starsearch_threads_user_thread.starsearch_thread_id"
      )
      .leftJoinAndSelect(
        "starsearch_threads.thread_history",
        "starsearch_threads_history",
        "starsearch_threads.id = starsearch_threads_history.starsearch_thread_id"
      )
      .where("starsearch_threads.id = :id", { id })
      .andWhere(
        new Brackets((qb) => {
          qb.where("starsearch_threads.is_publicly_viewable = true");

          if (userId) {
            qb.orWhere("starsearch_threads_user_thread.user_id = :userId", { userId });
          }
        })
      )
      .orderBy("starsearch_threads_history.observed_at", "ASC");

    const thread: DbStarSearchThread | null = await queryBuilder.getOne();

    if (!thread) {
      throw new NotFoundException();
    }

    return thread;
  }

  async findThreadHistoryById(id: string): Promise<DbStarSearchThreadHistory> {
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

  async findHistoryByIdForUserInThread(
    id: string,
    threadId: string,
    userId: number
  ): Promise<DbStarSearchThreadHistory> {
    const queryBuilder = this.starSearchThreadHistoryRepository.createQueryBuilder("starsearch_thread_history");

    queryBuilder
      .leftJoin(
        "starsearch_thread_history.thread",
        "starsearch_thread_history_thread",
        "starsearch_thread_history.starsearch_thread_id = starsearch_thread_history_thread.id"
      )
      .leftJoin(
        "starsearch_thread_history_thread.user_thread",
        "starsearch_thread_history_thread_user_thread",
        "starsearch_thread_history_thread.id = starsearch_thread_history_thread_user_thread.starsearch_thread_id"
      )
      .where("starsearch_thread_history.id = :id", { id })
      .andWhere("starsearch_thread_history_thread.id = :threadId", { threadId })
      .andWhere("starsearch_thread_history_thread_user_thread.user_id = :userId", { userId });

    const threadHistory: DbStarSearchThreadHistory | null = await queryBuilder.getOne();

    if (!threadHistory) {
      throw new NotFoundException();
    }

    return threadHistory;
  }

  async findUserThreads(pageOptionsDto: PageOptionsDto, userId: number): Promise<PageDto<DbStarSearchThread>> {
    const queryBuilder = this.baseQueryBuilder();

    queryBuilder.leftJoin("starsearch_threads.user_thread", "starsearch_threads_user_thread").where(
      `
      "starsearch_threads"."id" IN (
        SELECT "starsearch_thread_id" FROM "starsearch_user_threads" WHERE "user_id" = :userId
      )`,
      { userId }
    );

    queryBuilder.skip(pageOptionsDto.skip).take(pageOptionsDto.limit);
    queryBuilder.orderBy("starsearch_threads.updated_at", "DESC");

    const [itemCount, entities] = await Promise.all([queryBuilder.getCount(), queryBuilder.getMany()]);

    const pageMetaDto = new PageMetaDto({ itemCount, pageOptionsDto });

    return new PageDto(entities, pageMetaDto);
  }

  async createThread(userId: number): Promise<DbStarSearchThread> {
    return this.starSearchUserThreadRepository.manager.transaction(async (entityManager) => {
      const newThread = entityManager.create(DbStarSearchThread, {
        title: "New StarSearch thread",
      });

      const savedThread = await entityManager.save(DbStarSearchThread, newThread);

      const newUserThread = entityManager.create(DbStarSearchUserThread, {
        user_id: userId,
        starsearch_thread_id: savedThread.id,
      });

      await entityManager.save(DbStarSearchUserThread, newUserThread);

      return savedThread;
    });
  }

  async makeThreadPublicByIdForUser({ id, userId }: { id: string; userId: number }): Promise<DbStarSearchThread> {
    const apiCodename: string = this.configService.get("api.codename")!;

    const thread = await this.findThreadByIdForUser(id, userId);

    // no short URL found for thread, make one
    if (!thread.public_link) {
      let targetUrl;
      let shortUrl;

      switch (apiCodename) {
        case "api":
          targetUrl = `https://app.opensauced.pizza/star-search?share_id=${id}`;
          shortUrl = await this.urlShortenerService.createShortLink(targetUrl);
          thread.public_link = shortUrl.shortUrl;
          break;

        case "api-beta":
          targetUrl = `https://beta.app.opensauced.pizza/star-search?share_id=${id}`;
          shortUrl = await this.urlShortenerService.createShortLink(targetUrl);
          thread.public_link = shortUrl.shortUrl;
          break;

        case "api-alpha":
          targetUrl = `https://alpha.app.opensauced.pizza/star-search?share_id=${id}`;
          shortUrl = await this.urlShortenerService.createShortLink(targetUrl);
          thread.public_link = shortUrl.shortUrl;
          break;

        case "api-local":
          console.warn("detected local API deployment, skpping making dub.co link");
          targetUrl = `localhost:3000/star-search?id=${id}`;
          thread.public_link = targetUrl;
          break;

        default:
          break;
      }
    }

    thread.is_publicly_viewable = true;

    await this.starSearchThreadRepository.update(id, thread);

    return thread;
  }

  async makeThreadPrivateByIdForUser({ id, userId }: { id: string; userId: number }): Promise<DbStarSearchThread> {
    const thread = await this.findThreadByIdForUser(id, userId);

    thread.is_publicly_viewable = false;

    await this.starSearchThreadRepository.update(id, thread);

    return thread;
  }

  async updateThreadByIdForUser({
    id,
    userId,
    thread_summary = "",
    title = "",
    is_archived = null,
  }: {
    id: string;
    userId: number;
    thread_summary?: string;
    title?: string;
    is_archived?: boolean | null;
  }): Promise<DbStarSearchThread> {
    const thread = await this.findThreadByIdForUser(id, userId);

    if (thread_summary) {
      thread.thread_summary = thread_summary;
    }

    if (title) {
      thread.title = title;
    }

    if (is_archived === true) {
      thread.archived_at = new Date();
    }

    if (is_archived === false) {
      thread.archived_at = null;
    }

    await this.starSearchThreadRepository.update(id, thread);

    return thread;
  }

  async updateThreadHistory({
    threadId,
    threadHistoryId,
    userId,
    mood,
  }: {
    threadId: string;
    threadHistoryId: string;
    userId: number;
    mood: StarSearchThreadHistoryMoodEnum;
  }): Promise<DbStarSearchThreadHistory> {
    const history = await this.findHistoryByIdForUserInThread(threadHistoryId, threadId, userId);

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

    return this.findThreadHistoryById(id);
  }

  async deleteThread(id: string, userId: number): Promise<void> {
    const thread = await this.findThreadByIdForUser(id, userId);

    await this.starSearchThreadRepository.softDelete(thread.id);
  }
}
