import { registerAs } from "@nestjs/config";

export const BingConfig = registerAs("bing", () => ({
  subscriptionApiKey: String(process.env.BING_SUBSCRIPTION_API_KEY ?? "apikey"),
  endpoint: String(process.env.BING_ENDPOINT ?? "endpoint"),
}));

export default BingConfig;
