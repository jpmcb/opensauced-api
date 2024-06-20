import { Injectable, NotFoundException } from "@nestjs/common";

import { PageOptionsDto } from "../common/dtos/page-options.dto";
import { PageDto } from "../common/dtos/page.dto";
import { DbStarSearchThread } from "../star-search/entities/thread.entity";
import { StarSearchWorkspaceThreadService } from "../star-search/star-search-workspace-thread.service";
import { StarSearchThreadHistoryMoodEnum } from "../star-search/dtos/update-thread-history.dto";
import { DbStarSearchThreadHistory } from "../star-search/entities/thread-history.entity";
import { canUserEditWorkspace, canUserViewWorkspace } from "./common/memberAccess";
import { WorkspaceService } from "./workspace.service";

@Injectable()
export class WorkspaceStarSearchService {
  constructor(
    private workspaceService: WorkspaceService,
    private starSearchWorkspaceThreadService: StarSearchWorkspaceThreadService
  ) {}

  async findOneByIdWithHistory({
    workspaceId,
    threadId,
    userId,
  }: {
    workspaceId: string;
    threadId: string;
    userId: number;
  }): Promise<DbStarSearchThread> {
    const workspace = await this.workspaceService.findOneById(workspaceId);

    /*
     * viewers, editors, and owners can see who belongs to a workspace
     */

    const canView = canUserViewWorkspace(workspace, userId);

    if (!canView) {
      throw new NotFoundException();
    }

    return this.starSearchWorkspaceThreadService.findThreadWithHistoryByIdForWorkspace({ threadId, workspaceId });
  }

  async findAllByWorkspaceId(
    pageOptionsDto: PageOptionsDto,
    workspaceId: string,
    userId: number
  ): Promise<PageDto<DbStarSearchThread>> {
    const workspace = await this.workspaceService.findOneById(workspaceId);

    /*
     * viewers, editors, and owners can see who belongs to a workspace
     */

    const canView = canUserViewWorkspace(workspace, userId);

    if (!canView) {
      throw new NotFoundException();
    }

    return this.starSearchWorkspaceThreadService.findWorkspaceThreads(pageOptionsDto, workspaceId);
  }

  async updateWorkspaceThread({
    workspaceId,
    threadId,
    userId,
    title,
    isArchived,
  }: {
    workspaceId: string;
    threadId: string;
    userId: number;
    title: string;
    isArchived: boolean | null;
  }): Promise<DbStarSearchThread> {
    const workspace = await this.workspaceService.findOneById(workspaceId);

    /*
     * owners and editors can modify a workspace userList page
     */

    const canEdit = canUserEditWorkspace(workspace, userId);

    if (!canEdit) {
      throw new NotFoundException();
    }

    return this.starSearchWorkspaceThreadService.updateThreadByIdForWorkspace({
      threadId,
      workspaceId,
      title,
      isArchived,
    });
  }

  async createWorkspaceThread({
    workspaceId,
    userId,
  }: {
    workspaceId: string;
    userId: number;
  }): Promise<DbStarSearchThread> {
    const workspace = await this.workspaceService.findOneById(workspaceId);

    /*
     * owners and editors can modify a workspace userList page
     */

    const canEdit = canUserEditWorkspace(workspace, userId);

    if (!canEdit) {
      throw new NotFoundException();
    }

    return this.starSearchWorkspaceThreadService.createWorkspaceThread(workspaceId);
  }

  async updateWorkspaceThreadHistory({
    workspaceId,
    threadId,
    historyId,
    userId,
    mood,
  }: {
    workspaceId: string;
    threadId: string;
    historyId: string;
    userId: number;
    mood: StarSearchThreadHistoryMoodEnum;
  }): Promise<DbStarSearchThreadHistory> {
    const workspace = await this.workspaceService.findOneById(workspaceId);

    /*
     * owners and editors can modify a workspace userList page
     */

    const canEdit = canUserEditWorkspace(workspace, userId);

    if (!canEdit) {
      throw new NotFoundException();
    }

    return this.starSearchWorkspaceThreadService.updateThreadHistory({
      workspaceId,
      threadId,
      historyId,
      mood,
    });
  }

  async deleteWorkspaceThread({
    workspaceId,
    threadId,
    userId,
  }: {
    workspaceId: string;
    threadId: string;
    userId: number;
  }) {
    const workspace = await this.workspaceService.findOneById(workspaceId);

    /*
     * owners and editors can delete a workspace StarSearch thread
     */

    const canEdit = canUserEditWorkspace(workspace, userId);

    if (!canEdit) {
      throw new NotFoundException();
    }

    return this.starSearchWorkspaceThreadService.deleteWorkspaceThread({
      workspaceId,
      threadId,
    });
  }
}
