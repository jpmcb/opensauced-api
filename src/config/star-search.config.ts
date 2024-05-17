import { registerAs } from "@nestjs/config";

export const StarSearchConfig = registerAs("starsearch", () => ({
  managerSystemMessage: String(process.env.STARSEARCH_MANAGER_SYSTEM_MESSAGE),
  bingAgentSystemMessage: String(process.env.STARSEARCH_BING_AGENT_SYSTEM_MESSAGE),
  issuesAgentSystemMessage: String(process.env.STARSEARCH_ISSUES_AGENT_SYSTEM_MESSAGE),
  pullRequestAgentSystemMessage: String(process.env.STARSEARCH_PULL_REQUEST_AGENT_SYSTEM_MESSAGE),
}));

export default StarSearchConfig;
