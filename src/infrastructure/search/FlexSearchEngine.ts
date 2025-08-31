import { injectable, inject } from "tsyringe";
import { SearchEngine } from "../../application/ports/SearchEngine";
import { SearchQuery } from "../../domain/model/SearchQuery";
import { FlexSearchService, SearchScope } from "./core/FlexSearchService";
import { DI_TOKENS } from "../di/di-tokens";

/**
 * Adapter for FlexSearchService implementing the SearchEngine port
 */
@injectable()
export class FlexSearchEngine implements SearchEngine {
  constructor(
    @inject(DI_TOKENS.FlexSearchService)
    private readonly flexSearch: FlexSearchService
  ) {}

  async ensureIndexed(
    loader: () => Promise<Array<{ path: string; content: string }>>
  ): Promise<void> {
    const files = await loader();
    await this.flexSearch.indexFiles(
      files.map((f) => ({
        path: f.path,
        content: f.content,
      }))
    );
  }

  search(query: SearchQuery): Array<{
    id: string;
    score: number;
    matches: Record<string, string[]>;
  }> {
    if (!query.isActive) {
      return [];
    }

    const searchOptions = {
      query: query.query,
      scope: this.mapScope(query.scope),
      caseSensitive: query.caseSensitive,
      fuzzy: query.fuzzy ? query.fuzzy.maxEdits || 1 : false,
      suggest: false,
      limit: query.maxSuggestions || 100,
    };

    const results = this.flexSearch.search(searchOptions);

    return results.map((result) => ({
      id: result.id,
      score: result.score,
      matches: result.matches,
    }));
  }

  async matches(
    file: { path: string; content: string },
    query: SearchQuery
  ): Promise<boolean> {
    if (!query.isActive) {
      return false;
    }

    // Use a simple approach - check if any search result matches this file
    const results = this.search(query);
    return results.some((result) => result.id === file.path);
  }

  upsert(file: { path: string; content: string }): void {
    this.flexSearch.upsertDocument({
      path: file.path,
      content: file.content,
    });
  }

  remove(path: string): void {
    this.flexSearch.removeDocument(path);
  }

  clear(): void {
    this.flexSearch.clearCache();
  }

  private mapScope(scope: string): SearchScope {
    switch (scope) {
      case "content":
        return SearchScope.CONTENT;
      case "filename":
        return SearchScope.TITLES;
      case "both":
      default:
        return SearchScope.ALL;
    }
  }
}
