import { z } from "zod";

export const SearchBingParams = z.object({
  query: z.string({ description: "The query to search Bing with." }),
});
export type SearchBingParams = z.infer<typeof SearchBingParams>;

// bing agent params

export const BingSearchAgentParams = z.object({
  prompt: z.string({ description: "The prompt for the Bing Search AI Agent" }),
});
export type BingSearchAgentParams = z.infer<typeof BingSearchAgentParams>;
