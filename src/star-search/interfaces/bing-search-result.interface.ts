export interface BingSearchResponse {
  webPages: BingWebPages;
}

export interface BingWebPages {
  value: BingWebPageResult[];
}

export interface BingWebPageResult {
  name: string;
  url: string;
  displayUrl?: string;
  snippet: string;
  datePublished?: string;
}
