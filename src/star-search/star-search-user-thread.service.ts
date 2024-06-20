import { Brackets, Repository, SelectQueryBuilder } from "typeorm";
import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { PageMetaDto } from "../common/dtos/page-meta.dto";
import { PageDto } from "../common/dtos/page.dto";
import { PageOptionsDto } from "../common/dtos/page-options.dto";
import { UrlShortenerService } from "../url/url-shortener.service";
import { DbStarSearchThread } from "./entities/thread.entity";
import { DbStarSearchThreadHistory } from "./entities/thread-history.entity";
import { DbStarSearchUserThread } from "./entities/user-thread.entity";

@Injectable()
export class StarSearchUserThreadService {
  constructor(
    private readonly configService: ConfigService,
    private urlShortenerService: UrlShortenerService,
    @InjectRepository(DbStarSearchThread, "ApiConnection")
    private starSearchThreadRepository: Repository<DbStarSearchThread>,
    @InjectRepository(DbStarSearchThread, "ApiConnection")
    private starSearchUserThreadRepository: Repository<DbStarSearchUserThread>,
    @InjectRepository(DbStarSearchThreadHistory, "ApiConnection")
    private starSearchThreadHistoryRepository: Repository<DbStarSearchThreadHistory>
  ) {}

  baseQueryBuilder(): SelectQueryBuilder<DbStarSearchThread> {
    return this.starSearchThreadRepository.createQueryBuilder("starsearch_threads");
  }

  async findThreadByIdForUser({ threadId, userId }: { threadId: string; userId: number }): Promise<DbStarSearchThread> {
    const queryBuilder = this.baseQueryBuilder();

    queryBuilder
      .leftJoin(
        "starsearch_threads.user_thread",
        "starsearch_threads_user_thread",
        "starsearch_threads.id = starsearch_threads_user_thread.starsearch_thread_id"
      )
      .where("starsearch_threads.id = :threadId", { threadId })
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

  async findPublicThreadWithHistoryByIdForUser({
    threadId,
    userId,
  }: {
    threadId: string;
    userId: number | undefined;
  }): Promise<DbStarSearchThread> {
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
      .where("starsearch_threads.id = :threadId", { threadId })
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

  async createUserThread(userId: number): Promise<DbStarSearchThread> {
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

  async makeThreadPublicByIdForUser({
    threadId,
    userId,
  }: {
    threadId: string;
    userId: number;
  }): Promise<DbStarSearchThread> {
    const apiCodename: string = this.configService.get("api.codename")!;

    const thread = await this.findThreadByIdForUser({ threadId, userId });

    // no short URL found for thread, make one
    if (!thread.public_link) {
      let targetUrl;
      let shortUrl;

      switch (apiCodename) {
        case "api":
          targetUrl = `https://app.opensauced.pizza/star-search?share_id=${threadId}`;
          shortUrl = await this.urlShortenerService.createShortLink(targetUrl);
          thread.public_link = shortUrl.shortUrl;
          break;

        case "api-beta":
          targetUrl = `https://beta.app.opensauced.pizza/star-search?share_id=${threadId}`;
          shortUrl = await this.urlShortenerService.createShortLink(targetUrl);
          thread.public_link = shortUrl.shortUrl;
          break;

        case "api-alpha":
          targetUrl = `https://alpha.app.opensauced.pizza/star-search?share_id=${threadId}`;
          shortUrl = await this.urlShortenerService.createShortLink(targetUrl);
          thread.public_link = shortUrl.shortUrl;
          break;

        case "api-local":
          console.warn("detected local API deployment, skpping making dub.co link");
          targetUrl = `localhost:3000/star-search?id=${threadId}`;
          thread.public_link = targetUrl;
          break;

        default:
          break;
      }
    }

    thread.is_publicly_viewable = true;

    await this.starSearchThreadRepository.update(threadId, thread);

    return thread;
  }

  async makeThreadPrivateByIdForUser({
    threadId,
    userId,
  }: {
    threadId: string;
    userId: number;
  }): Promise<DbStarSearchThread> {
    const thread = await this.findThreadByIdForUser({ threadId, userId });

    thread.is_publicly_viewable = false;

    await this.starSearchThreadRepository.update(threadId, thread);

    return thread;
  }

  async deleteUserThread({ userId, threadId }: { userId: number; threadId: string }): Promise<void> {
    const thread = await this.findThreadByIdForUser({ threadId, userId });

    await this.starSearchThreadRepository.softDelete(thread.id);
  }
}
