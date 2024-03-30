import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DbPullRequestGitHubEvents } from "src/timescale/entities/pull_request_github_event.entity";
import { Repository } from "typeorm";

@Injectable()
export class TimescaleConsumerService {
  constructor(
    @InjectRepository(DbPullRequestGitHubEvents, "TimescaleConnection")
    private repo: Repository<any>
  ) { }

  async executeQuery(sql: string): Promise<any> {
    console.log(sql);

    if (!this.isValidSql(sql)) {
      throw new BadRequestException("Invalid SQL query.");
    }

    return this.repo.query(sql);
  }

  private isValidSql(sql: string): boolean {
    /*
     * this is more or less a placeholder.
     * In reality, the majority of the engineering effort that would go into this
     * feature would be in validating and affirming the query given the risky
     * nature of consuming and executing unknown sql.
     */

    if (!sql) {
      return false;
    }

    return true;
  }
}
