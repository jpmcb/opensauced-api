import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class UrlShortenerService {
  private readonly dubApiHost = this.configService.get<string>("dub.apiHost")!;
  private readonly dubApiKey = this.configService.get<string>("dub.apiKey")!;
  private readonly dubWorkspaceId = this.configService.get<string>("dub.dubWorkspaceId")!;
  private readonly domain = this.configService.get<string>("dub.domain")!;

  constructor(private configService: ConfigService) {}

  async shortenUrl(url: string) {
    try {
      const urlToValidate = new URL(url);

      if (
        !urlToValidate.host.endsWith("opensauced.pizza") &&
        !urlToValidate.host.endsWith("oss-insights.netlify.app") &&
        !urlToValidate.host.includes("localhost")
      ) {
        throw new BadRequestException("Invalid URL");
      }

      const response = await fetch(`${this.dubApiHost}/links?workspaceId=${this.dubWorkspaceId}&search=${url}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.dubApiKey}`,
        },
      });

      if (response.ok) {
        const results = (await response.json()) as { shortLink: string }[];

        if (results.length > 0) {
          return { shortUrl: results[0].shortLink };
        }

        return this.createShortLink(url);
      }
    } catch (e: unknown) {
      if (e instanceof Error) {
        throw new BadRequestException(`Unable to shorten URL ${e.message}`);
      }
    }
  }

  async createShortLink(url: string) {
    const customKey = this.getCustomKey(url);
    const response = await fetch(`${this.dubApiHost}/links?workspaceId=${this.dubWorkspaceId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.dubApiKey}`,
      },
      body: JSON.stringify({ url, domain: this.domain, key: customKey }),
    });

    if (response.ok) {
      const data = (await response.json()) as { shortLink: string };

      return { shortUrl: data.shortLink };
    }

    throw new BadRequestException("Unable to shorten URL");
  }

  getCustomKey(url: string) {
    const urlPath = new URL(url).pathname;

    // ex: /user/:username
    const userKey = new RegExp("^/user/(.*)$").test(urlPath) ? urlPath.split("/").pop() : undefined;

    if (userKey) {
      return userKey;
    }

    // ex: /s/:org/:repo
    const repoKey = new RegExp("^/s/(.*)$").test(urlPath) ? urlPath.split("/").slice(2).join("/") : undefined;

    if (repoKey) {
      return repoKey;
    }

    return undefined;
  }
}
