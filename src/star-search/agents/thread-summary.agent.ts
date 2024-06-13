import { Injectable } from "@nestjs/common";
import { OpenAIWrappedService } from "../../openai-wrapped/openai-wrapped.service";
import { ThreadSummaryAgentParams } from "../schemas/thread-summary.schema";

@Injectable()
export class ThreadSummaryAgent {
  constructor(private openAIWrappedService: OpenAIWrappedService) {}

  async generateThreadSummary(agentParams: ThreadSummaryAgentParams): Promise<string> {
    const generateThreadSummarySystemMessage = `You are a chat summary AI agent that is part of the OpenSauced StarSearch system. This system is a generative AI powered tool used to derive unique insights and understandings from open source contributions and contributors.

Your goal is to look at the previous chat history and derive a detailed summary of the chat log. This summary will be used in subsequent messages to provide accurate and detailed context to additional AI agents and future uses users make make of the StarSearch system.

You will be provided with the previous messages in the chat log, both user and AI agent messages.

If present, you will also be provided with the previous AI generated summary and title generated from previous calls. The previous summary and title may be empty if this is the first time the summary is being generated for a new chat thread.`;

    const generateThreadSummaryUserMessage = `Previous messages:
---
${agentParams.messages.join("\n\n")}

Previous thread summary:
---
${agentParams.previousSummary}

Previous thread title:
---
${agentParams.previousTitle}`;

    return this.openAIWrappedService.generateCompletion(
      generateThreadSummarySystemMessage,
      generateThreadSummaryUserMessage,
      7
    );
  }

  async generateThreadTitle(agentParams: ThreadSummaryAgentParams): Promise<string> {
    const generateThreadSummarySystemMessage = `You are a chat summary AI agent that is part of the OpenSauced StarSearch system. This system is a generative AI powered tool used to derive unique insights and understandings from open source contributions and contributors.

Your goal is to look at the previous chat history and derive a very short title for the chat thread. This title will be displayed for users of the StarSearch system to have a general understanding of what their various different chat threads encompass. The generated title should be no longer than 255 characters and should include NO MARKUP, only text.

You will be provided with the previous messages in the chat log, both user and AI agent messages.

If present, you will also be provided with the previous AI generated summary and title generated from previous calls. The previous summary and title may be empty if this is the first time the summary is being generated for a new chat thread.`;

    const generateThreadSummaryUserMessage = `Previous messages:
---
${agentParams.messages.join("\n\n")}

Previous thread summary:
---
${agentParams.previousSummary}

Previous thread title:
---
${agentParams.previousTitle}`;

    return this.openAIWrappedService.generateCompletion(
      generateThreadSummarySystemMessage,
      generateThreadSummaryUserMessage,
      7
    );
  }
}
