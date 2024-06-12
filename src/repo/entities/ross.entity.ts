import { ApiModelProperty } from "@nestjs/swagger/dist/decorators/api-model-property.decorator";
import { Column } from "typeorm";
import {
  DbRossContributorsHistogram,
  DbRossIndexHistogram,
} from "../../timescale/entities/ross_index_histogram.entity";

export class DbRepoRossIndex {
  @ApiModelProperty({
    description: "Histogram buckets for the ross index of a repo over a period of time",
  })
  @Column({
    select: false,
    insert: false,
  })
  ross: DbRossIndexHistogram[];

  @ApiModelProperty({
    description: "Histogram buckets for the new/returning/internal contributors of a repo over a period of time",
  })
  @Column({
    select: false,
    insert: false,
  })
  contributors: DbRossContributorsHistogram[];
}
