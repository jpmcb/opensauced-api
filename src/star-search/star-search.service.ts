import { Injectable } from "@nestjs/common";
import { ChatCompletionStream } from "openai/lib/ChatCompletionStream";
import { PullRequestGithubEventsVectorService } from "../timescale/pull_request_github-events_vector.service";
import { DbPullRequestGitHubEvents } from "../timescale/entities/pull_request_github_event.entity";
import { OpenAIWrappedService } from "../openai-wrapped/openai-wrapped.service";
import { StarSearchStreamDto } from "./dtos/create-star-search.dto";

@Injectable()
export class StarSearchService {
  constructor(
    private pullRequestGithubEventsVectorService: PullRequestGithubEventsVectorService,
    private openAIWrappedService: OpenAIWrappedService
  ) {}

  /*
   * this prompt template is intended to be used as the catch all prompt for
   * Star Search queries where a user is asking about someone or someone's work specifically.
   * It has a preamble for the GPT, some context derived from a similarity search,
   * and, finally, the question from the user
   */
  private promptTemplate(context: DbPullRequestGitHubEvents[], question: string) {
    const preamble = `Given the GitHub activities and contributions data provided below, generate an informed response to the upcoming query.

Prioritize the information in the following order to ensure the response's relevance and accuracy:

1. **User Login Information**: Identified by "User login:". This is crucial for associating activities and contributions with specific users and contributors. Annotate usenames with "@" like "@{username}".
2. **Repository Details**: Highlighted as "Repository name:", to understand the context of the contributions.
3. **Pull Request Data**: Details the nature of code contributions, including additions, modifications, and deletions.
4. **Issues Data**: Provides insight into the problems or enhancements discussed within the repository.

If the required information for a comprehensive answer is not available within the provided data, please respond with "I could not find an answer".

---------

`;

    let context_section = "";

    context.forEach((pr) => {
      context_section += `
User login: ${pr.pr_author_login}
Repository name: ${pr.repo_name ?? "No repo name found"}
Pull Request Title: ${pr.pr_title}
Pull Request Summary: ${pr.ai_summary ?? "No summary provided"}
      `;
    });

    const question_section = `----------

** Question **: ${question}

Please use the prioritized GitHub activities and contributions information to provide a detailed response to the question above.`;

    return preamble + context_section + question_section;
  }

  /*
   * this function performs "Retrieval Augmented Generation", or RAG for short.
   * It will do the following:
   * 1. Get the embedding from OpenAI for a query from the user
   * 2. Use the query embedding to do cosine similarity against the embeddings
   *    in the timescale pgvector store
   * 3. Build a prompt using the context from the retrieval
   * 4. Return an OpenAI stream
   */
  async starSearchStream(options: StarSearchStreamDto): Promise<ChatCompletionStream> {
    const queryEmbedding = await this.openAIWrappedService.generateEmbedding(options.query_text);

    const similarPrs = await this.pullRequestGithubEventsVectorService.cosineSimilarity({
      embedding: queryEmbedding,
      range: 30,
      prevDaysStartDate: 0,
    });

    const prompt = this.promptTemplate(similarPrs, options.query_text);
    const systemMessage =
      "You are assisting with inquiries based on detailed GitHub activities and contributions. Focus on delivering accurate, relevant answers, prioritizing information as outlined. For data not covered, use your understanding of GitHub practices to infer plausible responses when possible. If an answer cannot be accurately determined with the provided data, opt for a cautious approach and indicate the limitation. Maintain a formal tone and adhere to the structured response format.";

    return this.openAIWrappedService.getChatStream(systemMessage, prompt, 0.2);
  }
}
