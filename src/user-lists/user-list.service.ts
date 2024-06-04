import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  forwardRef,
} from "@nestjs/common";
import { Repository, SelectQueryBuilder } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";

import { DbUserHighlightRepo } from "../highlight/entities/user-highlight-repo.entity";
import { PageOptionsDto } from "../common/dtos/page-options.dto";
import { PageDto } from "../common/dtos/page.dto";
import { PagerService } from "../common/services/pager.service";
import { DbUser } from "../user/user.entity";
import { PageMetaDto } from "../common/dtos/page-meta.dto";
import { HighlightOptionsDto } from "../highlight/dtos/highlight-options.dto";
import { DbUserHighlight } from "../user/entities/user-highlight.entity";
import { GetPrevDateISOString } from "../common/util/datetimes";
import { WorkspaceService } from "../workspace/workspace.service";
import { DbWorkspaceUserLists } from "../workspace/entities/workspace-user-list.entity";
import { UserService } from "../user/services/user.service";
import { CreateUserListDto } from "./dtos/create-user-list.dto";
import { DbUserList } from "./entities/user-list.entity";
import { DbUserListContributor } from "./entities/user-list-contributor.entity";
import { FilterListContributorsDto } from "./dtos/filter-contributors.dto";
import { DbTimezone } from "./entities/timezones.entity";

@Injectable()
export class UserListService {
  constructor(
    @InjectRepository(DbUserList, "ApiConnection")
    private userListRepository: Repository<DbUserList>,
    @InjectRepository(DbUserListContributor, "ApiConnection")
    private userListContributorRepository: Repository<DbUserListContributor>,
    @InjectRepository(DbUserHighlight, "ApiConnection")
    private userHighlightRepository: Repository<DbUserHighlight>,
    @InjectRepository(DbUser, "ApiConnection")
    private userRepository: Repository<DbUser>,
    @InjectRepository(DbWorkspaceUserLists, "ApiConnection")
    private workspaceUserListsRepository: Repository<DbWorkspaceUserLists>,
    private pagerService: PagerService,
    @Inject(forwardRef(() => WorkspaceService))
    private workspaceService: WorkspaceService,
    private userService: UserService
  ) {}

  baseQueryBuilder(): SelectQueryBuilder<DbUserList> {
    const builder = this.userListRepository.createQueryBuilder("user_lists");

    return builder;
  }

  baseListContributorQueryBuilder(): SelectQueryBuilder<DbUserListContributor> {
    const builder = this.userListContributorRepository.createQueryBuilder("user_list_contributors");

    return builder;
  }

  baseUserQueryBuilder(): SelectQueryBuilder<DbUser> {
    const builder = this.userRepository.createQueryBuilder("users");

    return builder;
  }

  async findOneById(id: string, userId?: number): Promise<DbUserList> {
    const queryBuilder = this.baseQueryBuilder();

    queryBuilder
      .innerJoin("users", "users", "user_lists.user_id=users.id")
      .addSelect("users.login", "user_lists_login")
      .where("user_lists.id = :id", { id });

    if (userId) {
      queryBuilder.andWhere("user_lists.user_id = :userId", { userId });
    }

    const item: DbUserList | null = await queryBuilder.getOne();

    if (!item) {
      throw new NotFoundException();
    }

    return item;
  }

  async findPublicOneById(id: string, userId?: number): Promise<DbUserList> {
    const queryBuilder = this.baseQueryBuilder();

    queryBuilder
      .innerJoin("users", "users", "user_lists.user_id=users.id")
      .addSelect("users.login", "user_lists_login")
      .leftJoinAndSelect(
        `user_lists.workspaces`,
        `workspace_user_lists`,
        `user_lists.id=workspace_user_lists.user_list_id`
      )
      .where("user_lists.id = :id", { id });

    const item: DbUserList | null = await queryBuilder.getOne();

    if (!item) {
      throw new NotFoundException();
    }

    if (!item.is_public && userId && userId !== item.user_id) {
      throw new UnauthorizedException("You're not authorized to view this list");
    }

    return item;
  }

  async findAllByUserId(pageOptionsDto: PageOptionsDto, userId: number): Promise<PageDto<DbUserList>> {
    const queryBuilder = this.baseQueryBuilder();

    queryBuilder.where("user_lists.user_id = :userId", { userId }).orderBy("user_lists.updated_at", "DESC");

    return this.pagerService.applyPagination<DbUserList>({
      pageOptionsDto,
      queryBuilder,
    });
  }

  async findAllFeatured(pageOptionsDto: PageOptionsDto): Promise<PageDto<DbUserList>> {
    const queryBuilder = this.baseQueryBuilder();

    queryBuilder.where("is_featured=true").andWhere("is_public=true").orderBy("user_lists.updated_at", "DESC");

    return this.pagerService.applyPagination<DbUserList>({
      pageOptionsDto,
      queryBuilder,
    });
  }

  async addUserList(userId: number, list: CreateUserListDto, workspaceId: string): Promise<DbUserList> {
    let existingWorkspace;

    if (workspaceId === "") {
      existingWorkspace = await this.workspaceService.findPersonalWorkspaceByUserId(userId);
    } else {
      existingWorkspace = await this.workspaceService.findOneById(workspaceId);
    }

    const newUserList = await this.userListRepository.save({
      user_id: userId,
      name: list.name,
      is_public: list.is_public,
    });

    await this.workspaceUserListsRepository.save({
      user_list_id: newUserList.id,
      workspace_id: existingWorkspace.id,
    });

    return newUserList;
  }

  async addUserListContributor(listId: string, userId?: number, username?: string) {
    if (!userId && !username) {
      throw new BadRequestException("either user id or login username must be provided");
    }

    const existingContributor = await this.userListContributorRepository.findOne({
      where: {
        list_id: listId,
        user_id: userId,
        username,
      },
      withDeleted: true,
    });

    if (existingContributor) {
      await this.userListContributorRepository.restore(existingContributor.id);
      return existingContributor;
    }

    const user = await this.userService.tryFindUserOrMakeStub(userId, username);

    const newUserListContributor = this.userListContributorRepository.create({
      list_id: listId,
      user_id: user.id,
      username: user.login,
    });

    return this.userListContributorRepository.save(newUserListContributor);
  }

  async deleteUserListContributor(id: string, userListContributorId: string) {
    const contributor = await this.userListContributorRepository.findOne({
      where: {
        id: userListContributorId,
        list_id: id,
      },
    });

    if (contributor) {
      return this.userListContributorRepository.softDelete(userListContributorId);
    }

    throw new NotFoundException("User list contributor not found for given list ID");
  }

  async updateUserList(listId: string, highlight: Partial<DbUserList>) {
    return this.userListRepository.update(listId, highlight);
  }

  async deleteUserList(listId: string) {
    const workspaceUserList = await this.workspaceUserListsRepository.findOne({
      where: {
        user_list_id: listId,
      },
      withDeleted: false,
    });

    if (!workspaceUserList) {
      throw new NotFoundException("could not find workspace user list link for given insight");
    }

    await this.workspaceUserListsRepository.softDelete(workspaceUserList.id);
    return this.userListRepository.softDelete(listId);
  }

  async findContributorsByFilter(pageOptionsDto: FilterListContributorsDto): Promise<PageDto<DbUser>> {
    const queryBuilder = this.userRepository.createQueryBuilder("user");

    if (pageOptionsDto.contributor) {
      queryBuilder.andWhere("LOWER(user.login) LIKE :contributor", {
        contributor: `%${pageOptionsDto.contributor.toLowerCase()}%`,
      });
    }

    if (pageOptionsDto.location) {
      queryBuilder.andWhere("user.location in (:...location)", { location: pageOptionsDto.location });
    }

    if (pageOptionsDto.timezone) {
      queryBuilder.andWhere("user.timezone in (:...timezone)", { timezone: pageOptionsDto.timezone });
    }

    // skip "users" who are actually orgs
    queryBuilder.andWhere("type != 'Organization'");

    queryBuilder.offset(pageOptionsDto.skip).limit(pageOptionsDto.limit);

    const [itemCount, entities] = await Promise.all([queryBuilder.getCount(), queryBuilder.getMany()]);
    const pageMetaDto = new PageMetaDto({ itemCount, pageOptionsDto });

    return new PageDto(entities, pageMetaDto);
  }

  async findAllContributorsByListId(listId: string): Promise<DbUserListContributor[]> {
    const queryBuilder = this.userListContributorRepository.createQueryBuilder("user_list_contributors");

    queryBuilder
      .leftJoin("users", "users", "user_list_contributors.user_id=users.id")
      .addSelect("users.login", "user_list_contributors_login")
      .where("user_list_contributors.list_id = :listId", { listId });

    return queryBuilder.getMany();
  }

  async findContributorsByListId(
    pageOptionsDto: FilterListContributorsDto,
    listId: string
  ): Promise<PageDto<DbUserListContributor>> {
    const queryBuilder = this.userListContributorRepository.createQueryBuilder("user_list_contributors");

    queryBuilder
      .leftJoin("users", "users", "user_list_contributors.user_id=users.id")
      .addSelect("users.login", "user_list_contributors_login")
      .where("user_list_contributors.list_id = :listId", { listId });

    if (pageOptionsDto.contributor) {
      queryBuilder.andWhere("LOWER(users.login) LIKE :contributor", {
        contributor: `%${pageOptionsDto.contributor.toLowerCase()}%`,
      });
    }

    return this.pagerService.applyPagination<DbUserListContributor>({
      pageOptionsDto,
      queryBuilder,
    });
  }

  async findListContributorsHighlights(
    pageOptionsDto: HighlightOptionsDto,
    listId: string
  ): Promise<PageDto<DbUserHighlight>> {
    const startDate = GetPrevDateISOString(pageOptionsDto.prev_days_start_date);
    const range = pageOptionsDto.range ?? 30;
    const orderBy = pageOptionsDto.orderDirection ?? "DESC";
    const queryBuilder = this.userHighlightRepository.createQueryBuilder("user_highlights");

    // return all highlights that belongs to a contributor of the list id
    queryBuilder
      .innerJoin(
        "user_list_contributors",
        "user_list_contributors",
        "user_list_contributors.user_id = user_highlights.user_id"
      )
      .innerJoin("users", "users", "user_highlights.user_id=users.id")
      .addSelect("users.name", "user_highlights_name")
      .addSelect("users.login", "user_highlights_login")
      .where("user_list_contributors.list_id = :listId", { listId })
      .andWhere(`:start_date::TIMESTAMP - :range_interval::INTERVAL <= "user_highlights"."updated_at"`, {
        start_date: startDate,
        range_interval: `${range} days`,
      });

    if (pageOptionsDto.repo) {
      queryBuilder.andWhere(
        `EXISTS (
        SELECT 1
        FROM unnest(user_highlights.tagged_repos) AS repos
        WHERE repos LIKE :repo_search
      )`,
        { repo_search: `%${pageOptionsDto.repo}%` }
      );
    }

    if (pageOptionsDto.contributor) {
      queryBuilder.andWhere("LOWER(users.login) LIKE :contributor", {
        contributor: `%${pageOptionsDto.contributor.toLowerCase()}%`,
      });
    }

    queryBuilder.orderBy("user_highlights.updated_at", orderBy);
    queryBuilder.offset(pageOptionsDto.skip).limit(pageOptionsDto.limit);

    const [itemCount, entities] = await Promise.all([queryBuilder.getCount(), queryBuilder.getMany()]);

    const pageMetaDto = new PageMetaDto({ itemCount, pageOptionsDto });

    return new PageDto(entities, pageMetaDto);
  }

  async findListContributorsHighlightedRepos(
    pageOptionsDto: PageOptionsDto,
    listId: string
  ): Promise<PageDto<DbUserHighlightRepo>> {
    const startDate = GetPrevDateISOString(pageOptionsDto.prev_days_start_date);
    const range = pageOptionsDto.range ?? 30;
    const orderBy = pageOptionsDto.orderDirection ?? "DESC";
    const queryBuilder = this.userHighlightRepository.createQueryBuilder("user_highlights");

    queryBuilder.select("DISTINCT UNNEST(user_highlights.tagged_repos) AS full_name");

    queryBuilder
      .innerJoin(
        "user_list_contributors",
        "user_list_contributors",
        "user_list_contributors.user_id = user_highlights.user_id"
      )
      .where("user_list_contributors.list_id = :listId", { listId })
      .andWhere(`:start_date::TIMESTAMP - :range_interval <= "user_highlights"."updated_at"`, {
        start_date: startDate,
        range_interval: `${range} days`,
      });
    queryBuilder.orderBy("full_name", orderBy);
    queryBuilder.offset(pageOptionsDto.skip).limit(pageOptionsDto.limit);

    const subQuery = this.userHighlightRepository.manager
      .createQueryBuilder()
      .addCommonTableExpression(queryBuilder, "CTE")
      .setParameters(queryBuilder.getParameters())
      .select("count(full_name)")
      .from("CTE", "CTE");

    const countQueryResult = await subQuery.getRawOne<{ count: number }>();
    const itemCount = parseInt(`${countQueryResult?.count ?? "0"}`, 10);

    const entities = await queryBuilder.getRawMany();
    const pageMetaDto = new PageMetaDto({ itemCount, pageOptionsDto });

    return new PageDto(entities, pageMetaDto);
  }

  async getAllTimezones(): Promise<DbTimezone[]> {
    const queryBuilder = this.baseUserQueryBuilder();

    queryBuilder
      .select("DISTINCT users.timezone as timezone")
      .where("users.timezone IS NOT NULL")
      .andWhere("users.timezone != ''");

    const timezones: DbTimezone[] = await queryBuilder.getRawMany();

    return timezones;
  }
}
