import { Injectable } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { AxiosResponse } from "@nestjs/terminus/dist/health-indicator/http/axios.interfaces";
import { BingSearchResultDto } from "./dtos/bing-search-results.dto";
import { BingSearchResponse, BingWebPageResult } from "./interfaces/bing-search-result.interface";

@Injectable()
export class BingSearchToolsSearch {
  constructor(private httpService: HttpService, private configService: ConfigService) {}

  async bingSearch(query: string): Promise<BingSearchResultDto[]> {
    const subscriptionApiKey: string = this.configService.get("bing.subscriptionApiKey")!;
    const endpoint: string = this.configService.get("bing.endpoint")!;

    try {
      const response: AxiosResponse<BingSearchResponse> | undefined = await this.httpService
        .get(endpoint, {
          params: {
            /*
             * the params to Bing search include:
             *
             * q - the query to send to bing.
             * textDecorations - adds metadata to the search results (such as bolding)
             * textFormat - the return format of the resulting text which an LLM can parse
             * count - The number of results to return
             */

            q: query,
            textDecorations: "True",
            textFormat: "HTML",
            count: 10,
          },
          headers: { "Ocp-Apim-Subscription-Key": subscriptionApiKey },
        })
        .toPromise();

      return this.parseBingSearchResults(response!.data);
    } catch (error: unknown) {
      if (error instanceof Error) {
        /*
         * simply bail out and return nothing (so that the LLM tools loop can continue
         * and possibly recover).
         */
        console.log(error);
        return [];
      }

      return [];
    }
  }

  private parseBingSearchResults(searchResults: BingSearchResponse): BingSearchResultDto[] {
    const cleanResults: BingSearchResultDto[] = [];

    searchResults.webPages.value.forEach((result: BingWebPageResult) => {
      const details: BingSearchResultDto = {
        title: result.name,
        url: result.url,
        displayUrl: result.displayUrl ?? result.url,
        snippet: result.snippet,
        datePublished: result.datePublished ?? "date not available",
      };

      cleanResults.push(details);
    });

    return cleanResults;
  }
}
