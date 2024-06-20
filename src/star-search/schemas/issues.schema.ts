import { z } from "zod";

export const SearchAllIssuesParams = z.object({
  question: z.string({ description: "The input query to search all issues with." }),
});
export type SearchAllIssuesParams = z.infer<typeof SearchAllIssuesParams>;

export const SearchAllIssuesInDatasetParams = z.object({
  question: z.string({ description: "The input query to search issues within the dataset." }),
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
export type SearchAllIssuesInDatasetParams = z.infer<typeof SearchAllIssuesInDatasetParams>;

export const SearchIssuesByRepoNameParams = z.object({
  question: z.string({ description: "The input query to search issues with." }),
  repoName: z.string({
    description:
      "The name of the GitHub repository to filter on. Should be of the form 'org/name'. Example: 'facebook/react' or 'microsoft/vscode'.",
  }),
});
export type SearchIssuesByRepoNameParams = z.infer<typeof SearchIssuesByRepoNameParams>;

export const SearchIssuesByAuthorParams = z.object({
  question: z.string({ description: "The input query to search issues with." }),
  author: z.string({
    description: "The GitHub username of the issue author to filter on. Should be of the form 'username'.",
  }),
});
export type SearchIssuesByAuthorParams = z.infer<typeof SearchIssuesByAuthorParams>;

export const SearchIssuesByRepoNameAndAuthorParams = z.object({
  question: z.string({ description: "The input query to search issues with." }),
  repoName: z.string({
    description:
      "The name of the GitHub repository to filter on. Should be of the form 'org/name'. Example: 'facebook/react' or 'microsoft/vscode'.",
  }),
  author: z.string({
    description: "The GitHub username of the issue author to filter on. Should be of the form 'username'.",
  }),
});
export type SearchIssuesByRepoNameAndAuthorParams = z.infer<typeof SearchIssuesByRepoNameAndAuthorParams>;

export const SearchIssuesByAuthorInDatasetParams = z.object({
  question: z.string({ description: "The input query to search issues within the dataset." }),
  author: z.string({
    description: "The GitHub username of the issue author to filter on. Should be of the form 'username'.",
  }),
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
export type SearchIssuesByAuthorInDatasetParams = z.infer<typeof SearchIssuesByAuthorInDatasetParams>;

// issues agent params

export const IssuesAgentParams = z.object({
  prompt: z.string(),
});
export type IssuesAgentParams = z.infer<typeof IssuesAgentParams>;
