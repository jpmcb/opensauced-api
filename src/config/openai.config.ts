import { registerAs } from "@nestjs/config";

export const OpenAIConfig = registerAs("openai", () => ({
  APIKey: String(process.env.OPENAI_API_KEY ?? "apikey"),
  completionsModelName: String(process.env.OPENAI_COMPLETIONS_MODEL_NAME ?? "gpt-4"),
  embeddingsModelName: String(process.env.OPENAI_EMBEDDINGS_MODEL_NAME ?? "text-embedding-3-large"),
  embeddingsModelDimensions: String(process.env.OPENAI_EMBEDDINGS_MODEL_DIMENSIONS ?? "1024"),
}));

export default OpenAIConfig;
