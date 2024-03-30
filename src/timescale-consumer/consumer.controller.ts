import { Body, Controller, Post, ValidationPipe } from "@nestjs/common";
import { ApiBody, ApiTags } from "@nestjs/swagger";
import { TimescaleConsumerService } from "./consumer.service";

@Controller("timescale")
@ApiTags("Timescale consumer service")
export class TimescaleConsumerController {
  constructor(private readonly timescaleConsumerService: TimescaleConsumerService) { }

  @Post("/execute")
  @ApiBody({ type: String })
  async execute(@Body() sql: string) {
    return this.timescaleConsumerService.executeQuery(sql);
  }
}
