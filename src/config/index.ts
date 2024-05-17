import { z } from "zod";

export const envSchema = z.object({
  OPENAI_SHORT_CIRCUIT_DECIDER_SYSTEM_MESSAGE: z
    .string()
    .min(1, "OpenAI short-circuit decider system message is required"),
  STARSEARCH_MANAGER_SYSTEM_MESSAGE: z.string().min(1, "StarSearch manager system message is required"),
  STARSEARCH_BING_AGENT_SYSTEM_MESSAGE: z.string().min(1, "StarSearch bing agent system message is required"),
  STARSEARCH_ISSUES_AGENT_SYSTEM_MESSAGE: z.string().min(1, "StarSearch issues agent system message is required"),
  STARSEARCH_PULL_REQUEST_AGENT_SYSTEM_MESSAGE: z
    .string()
    .min(1, "StarSearch pull request agent system message is required"),
});

export * from "./api.config";
export * from "./db-api.config";
export * from "./db-logging.config";
export * from "./endpoint.config";
export * from "./stripe.config";
export * from "./openai.config";
export * from "./bing.config";
export * from "./pizza.config";
export * from "./timescale.config";
export * from "./github.config";
export * from "./dub.config";
export * from "./star-search.config";
