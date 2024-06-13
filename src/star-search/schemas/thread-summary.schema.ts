import { z } from "zod";

// thread summary agent params

export const ThreadSummaryAgentParams = z.object({
  messages: z.array(z.string()),
  previousSummary: z.string(),
  previousTitle: z.string(),
});

export type ThreadSummaryAgentParams = z.infer<typeof ThreadSummaryAgentParams>;
