import { z } from "zod";

/*
 *  types and schemas for the PreProcessorAgent
 */

export const PreProcessorProcessedPrompt = z.object({
  prompt: z.string(),
});
export type PreProcessorProcessedPrompt = z.infer<typeof PreProcessorProcessedPrompt>;

export const PreProcessorError = z.object({
  error: z.string(),
});
export type PreProcessorError = z.infer<typeof PreProcessorError>;

// utility function that returns a boolean if some returned type is a PreProcessorError.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isPreProcessorError(obj: any): obj is PreProcessorError {
  const result = PreProcessorError.safeParse(obj);

  return result.success;
}

export const PreProcessorAgentParams = z.object({
  prompt: z.string(),
  threadSummary: z.string().nullable(),
  lastMessage: z.string().nullable(),
});
export type PreProcessorAgentParams = z.infer<typeof PreProcessorAgentParams>;
