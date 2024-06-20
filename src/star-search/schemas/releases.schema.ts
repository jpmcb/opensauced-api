import { z } from "zod";

export const ReleasesParams = z.object({
  repoName: z.string({ description: "The GitHub repository name to search for releases in." }),
});
export type ReleasesParams = z.infer<typeof ReleasesParams>;

export const ReleasesInDatasetParams = z.object({
  dataset: z.array(
    z.string({
      description:
        "Name of a github repository. Should be of the form 'org/name'. Example: 'facebook/react' or 'microsoft/vscode'.",
    }),
    {
      description: "An array of GitHub repo names that represent the dataset to search.",
    }
  ),
});
export type ReleasesInDatasetParams = z.infer<typeof ReleasesInDatasetParams>;

// release agent params

export const ReleaseAgentParams = z.object({
  prompt: z.string({ description: "The prompt for the Release AI Agent." }),
});
export type ReleaseAgentParams = z.infer<typeof ReleaseAgentParams>;
