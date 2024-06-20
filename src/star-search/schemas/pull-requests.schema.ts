import { z } from "zod";

export const SearchAllPrsParams = z.object({
  question: z.string({ description: "The input query to search all pull reqeuests with." }),
});
export type SearchAllPrsParams = z.infer<typeof SearchAllPrsParams>;

export const SearchAllPrsInDatasetParams = z.object({
  question: z.string({ description: "The input query to search all pull reqeuests with." }),
  dataset: z.array(z.string({ description: "name of a github repository" }), {
    description: "an array of repo names that represent the dataset to search",
  }),
});
export type SearchAllPrsInDatasetParams = z.infer<typeof SearchAllPrsInDatasetParams>;

export const SearchPrsByRepoNameParams = z.object({
  question: z.string({ description: "The input query to search pull requests with." }),
  repoName: z.string({
    description:
      "The name of the GitHub repository to filter on. Should be of the form 'org/name'. Example: 'microsoft/vscode'",
  }),
  range: z
    .number({
      description: "the number of days in the past to look back for data",
    })
    .lte(90, "can only look back 90 days or less"),
});
export type SearchPrsByRepoNameParams = z.infer<typeof SearchPrsByRepoNameParams>;

export const SearchPrsByAuthorParams = z.object({
  question: z.string({ description: "The input query to search the author's pull requests with." }),
  author: z.string({
    description:
      "The GitHub login of the pull request author to filter on. Should be of the form 'login'. Example: 'brandonroberts'",
  }),
});
export type SearchPrsByAuthorParams = z.infer<typeof SearchPrsByAuthorParams>;

export const SearchPrsByRepoNameAndAuthorParams = z.object({
  question: z.string({ description: "The input query to search pull requests with." }),
  repoName: z.string({
    description:
      "The name of the GitHub repository to filter on. Should be of the form 'org/name'. Example: 'microsoft/vscode'",
  }),
  author: z.string({
    description:
      "The GitHub login of the pull request author to filter on. Should be of the form 'login'. Example: 'brandonroberts'",
  }),
});
export type SearchPrsByRepoNameAndAuthorParams = z.infer<typeof SearchPrsByRepoNameAndAuthorParams>;

export const SearchPrsByAuthorInDatasetParams = z.object({
  question: z.string({ description: "The input query to search pull requests with." }),
  dataset: z.array(z.string({ description: "name of a github repository" }), {
    description: "an array of repo names that represent the dataset",
  }),
  author: z.string({
    description:
      "The GitHub login of the pull request author to filter on. Should be of the form 'login'. Example: 'brandonroberts'",
  }),
});
export type SearchPrsByAuthorInDatasetParams = z.infer<typeof SearchPrsByAuthorInDatasetParams>;

// pull request agent params

export const PullRequestAgentParams = z.object({
  prompt: z.string(),
  dataset: z
    .array(z.string({ description: "name of a github repository" }), {
      description: "an array of repo names that represent the dataset",
    })
    .nullable(),
});
export type PullRequestAgentParams = z.infer<typeof PullRequestAgentParams>;
