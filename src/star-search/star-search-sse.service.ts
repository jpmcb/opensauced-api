import { BadRequestException, Injectable } from "@nestjs/common";
import { ChatCompletionMessage } from "openai/resources";
import { Observable } from "rxjs";
import { ChatCompletionStreamingRunner } from "openai/lib/ChatCompletionStreamingRunner";
import { OpenAIWrappedService } from "../openai-wrapped/openai-wrapped.service";
import { DbStarSearchThread } from "./entities/thread.entity";
import { StarSearchToolsService } from "./star-search-tools.service";
import { PreProcessorAgent } from "./agents/pre-processor.agent";
import { ThreadSummaryAgent } from "./agents/thread-summary.agent";
import { StarSearchActorEnum, StarSearchEventTypeEnum, StarSearchPayloadStatusEnum } from "./types/star-search.type";
import { StarSearchThreadService } from "./star-search-thread.service";
import { isPreProcessorError } from "./schemas/pre-processor.schema";
import { StarSearchResult } from "./interfaces/results.interface";
import { StarSearchWorkspaceToolsService } from "./star-search-workspace-tools.service";

@Injectable()
export class StarSearchSseService {
  constructor(
    private readonly openAIWrappedService: OpenAIWrappedService,
    private readonly starSearchToolsService: StarSearchToolsService,
    private readonly starSearchWorkspaceToolsService: StarSearchWorkspaceToolsService,
    private readonly preProcessAgent: PreProcessorAgent,
    private readonly threadSummaryAgent: ThreadSummaryAgent,
    private readonly starSearchThreadsService: StarSearchThreadService
  ) {}

  async run({
    thread,
    queryText,
    dataset,
  }: {
    thread: DbStarSearchThread;
    queryText: string;
    dataset?: string[];
  }): Promise<Observable<StarSearchResult>> {
    /*
     * get the metadata for this StarSearch thread
     */

    const lastMessage = thread.thread_history[0]?.message ?? "";
    const threadSummary = thread.thread_summary ?? "";

    /*
     * run the pre-processor agent to validate the incoming prompt, check for
     * prompt injection attempts, and cleanup the user's query
     */
    const preProcessResults = await this.preProcessAgent.preProcessPrompt({
      prompt: queryText,
      threadSummary,
      lastMessage,
    });

    if (!preProcessResults) {
      throw new BadRequestException();
    }

    if (isPreProcessorError(preProcessResults)) {
      throw new BadRequestException(`error: ${preProcessResults.error}`);
    }

    /*
     * kick off the StarSearch manager
     */

    let stream: ChatCompletionStreamingRunner;

    if (dataset) {
      stream = this.starSearchWorkspaceToolsService.runTools({
        question: preProcessResults.prompt,
        lastMessage,
        threadSummary,
        dataset,
      });
    } else {
      stream = this.starSearchToolsService.runTools({
        question: preProcessResults.prompt,
        lastMessage,
        threadSummary,
      });
    }

    /*
     * add the current user prompt to the thread history
     */

    const newUserHistory = await this.starSearchThreadsService.newThreadHistory(thread.id);

    const userContent = {
      data: {
        id: newUserHistory.id,
        author: StarSearchActorEnum.user,
        iso_time: new Date().toISOString(),
        content: {
          type: StarSearchEventTypeEnum.user_prompt,
          parts: [queryText],
        },
        status: StarSearchPayloadStatusEnum.recieved_user_query,
        error: null,
      },
    };

    const userQueryEmbedding = await this.openAIWrappedService.generateEmbedding(queryText);

    await this.starSearchThreadsService.addToThreadHistory({
      id: newUserHistory.id,
      type: StarSearchEventTypeEnum.user_prompt,
      message: JSON.stringify(userContent.data),
      actor: StarSearchActorEnum.user,
      embedding: userQueryEmbedding,
    });

    const newAgentContentHistory = await this.starSearchThreadsService.newThreadHistory(thread.id);

    let message = "";

    return new Observable<StarSearchResult>((observer) => {
      stream
        .on("content", (delta) => {
          message += delta;

          observer.next({
            data: {
              id: newAgentContentHistory.id,
              author: StarSearchActorEnum.manager,
              iso_time: new Date().toISOString(),
              content: {
                type: StarSearchEventTypeEnum.content,
                parts: [message],
              },
              status: StarSearchPayloadStatusEnum.in_progress,
              error: null,
            },
          });
        })
        .on("message", (msg) => console.log("manager msg", msg))
        .on("functionCall", async (functionCall: ChatCompletionMessage.FunctionCall) => {
          console.log("manager functionCall", functionCall);

          const functionCallContent = {
            data: {
              id: newAgentContentHistory.id,
              author: StarSearchActorEnum.manager,
              iso_time: new Date().toISOString(),
              content: {
                type: StarSearchEventTypeEnum.function_call,
                parts: [JSON.stringify(functionCall)],
              },
              status: StarSearchPayloadStatusEnum.in_progress,
              error: null,
            },
          };

          observer.next(functionCallContent);

          /*
           * add the function call (with it's message payload) to the thread history
           * so that a client can replay the enriched UI for that specific function call
           */

          const newAgentFuncCallHistory = await this.starSearchThreadsService.newThreadHistory(thread.id);

          await this.starSearchThreadsService.addToThreadHistory({
            id: newAgentFuncCallHistory.id,
            type: StarSearchEventTypeEnum.function_call,
            message: JSON.stringify(functionCallContent.data),
            actor: StarSearchActorEnum.manager,
          });
        })
        .on("functionCallResult", (functionCallResult) =>
          console.log("manager functionCallResult", functionCallResult)
        );

      stream
        .finalChatCompletion()
        .then(async () => {
          const finalContent = {
            data: {
              id: newAgentContentHistory.id,
              author: StarSearchActorEnum.manager,
              iso_time: new Date().toISOString(),
              content: {
                type: StarSearchEventTypeEnum.final,
                parts: [message],
              },
              status: StarSearchPayloadStatusEnum.done,
              error: null,
            },
          };

          // done sending SSEs, can finalize observer and cleanup async
          observer.next(finalContent);
          observer.complete();

          const historyMessages = thread.thread_history.slice(0, 5).map((history) => history.message ?? "");

          /*
           * add the final content to the thread history
           */

          const llmResponseEmbedding = await this.openAIWrappedService.generateEmbedding(message);

          await this.starSearchThreadsService.addToThreadHistory({
            id: newAgentContentHistory.id,
            type: StarSearchEventTypeEnum.final,
            message: JSON.stringify(finalContent.data),
            actor: StarSearchActorEnum.manager,
            embedding: llmResponseEmbedding,
          });

          /*
           * update the thread summary / title based on the recent history
           */

          const threadSummary = await this.threadSummaryAgent.generateThreadSummary({
            messages: [message, ...historyMessages],
            previousSummary: thread.thread_summary ?? "",
            previousTitle: thread.title ?? "",
          });

          const title = await this.threadSummaryAgent.generateThreadTitle({
            messages: [message, ...historyMessages],
            previousSummary: thread.thread_summary ?? "",
            previousTitle: thread.title ?? "",
          });

          await this.starSearchThreadsService.updateThreadById({
            threadId: thread.id,
            threadSummary,
            title,
          });

          return undefined;
        })
        .catch(() => observer.complete());

      return () => stream.abort();
    });
  }
}
