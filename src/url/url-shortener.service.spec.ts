import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";

import { UrlShortenerService } from "./url-shortener.service";

describe("UrlShortenerService", () => {
  let service: UrlShortenerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UrlShortenerService, ConfigService],
    }).compile();

    service = module.get<UrlShortenerService>(UrlShortenerService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("should throw an error for an invalid URL", async () => {
    let error;

    try {
      await service.shortenUrl("https://opensauces.pizza");
    } catch (e: unknown) {
      error = e;
      console.log(e);
    }

    expect(error).toBeDefined();
  });

  it("should return a custom key for a URL for a contributor profile", () => {
    const customKey = service.getCustomKey("https://app.opensauced.pizza/user/bdougie");

    expect(customKey).toBe("bdougie");
  });

  it("should return a custom key for a URL for a repo page", () => {
    const customKey = service.getCustomKey("https://app.opensauced.pizza/s/open-sauced/app");

    expect(customKey).toBe("open-sauced/app");
  });

  it("should not return a custom key for a URL for a non contributor/repo page", () => {
    const customKey = service.getCustomKey("https://app.opensauced.pizza/feed");

    expect(customKey).toBeUndefined();
  });
});
