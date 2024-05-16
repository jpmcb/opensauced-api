import { z } from "zod";

export const SearchAllIssuesParams = z.object({
  question: z.string(),
});
export type SearchAllIssuesParams = z.infer<typeof SearchAllIssuesParams>;

export const SearchIssuesByRepoNameParams = z.object({
  question: z.string(),
  repoName: z.string(),
});
export type SearchIssuesByRepoNameParams = z.infer<typeof SearchIssuesByRepoNameParams>;

export const SearchIssuesByAuthorParams = z.object({
  question: z.string(),
  author: z.string(),
});
export type SearchIssuesByAuthorParams = z.infer<typeof SearchIssuesByAuthorParams>;

export const SearchIssuesByRepoNameAndAuthorParams = z.object({
  question: z.string(),
  repoName: z.string(),
  author: z.string(),
});
export type SearchIssuesByRepoNameAndAuthorParams = z.infer<typeof SearchIssuesByRepoNameAndAuthorParams>;

// issues agent params

export const IssuesAgentParams = z.object({
  prompt: z.string(),
});
export type IssuesAgentParams = z.infer<typeof IssuesAgentParams>;
