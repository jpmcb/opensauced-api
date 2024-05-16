import { z } from "zod";

export const ReleasesParams = z.object({
  repoName: z.string(),
});
export type ReleasesParams = z.infer<typeof ReleasesParams>;

// release agent params

export const ReleaseAgentParams = z.object({
  prompt: z.string(),
});
export type ReleaseAgentParams = z.infer<typeof ReleaseAgentParams>;
