import { z } from "zod";

export const SearchBingParams = z.object({
  query: z.string(),
});
export type SearchBingParams = z.infer<typeof SearchBingParams>;

// bing agent params

export const BingSearchAgentParams = z.object({
  prompt: z.string(),
});
export type BingSearchAgentParams = z.infer<typeof BingSearchAgentParams>;
