import { FileManager, ContentSearchResult, PromptFile } from "./fileManager";
import { SearchCriteria } from "./searchPanelProvider";

export class SearchService {
  constructor(private fileManager: FileManager) {}

  /**
   * Centralized search method that handles scope routing
   */
  async search(criteria: SearchCriteria): Promise<ContentSearchResult[]> {
    if (!criteria.isActive || !criteria.query.trim()) {
      return [];
    }

    const searchOptions = {
      caseSensitive: criteria.caseSensitive,
      exact: false,
    };

    let results: ContentSearchResult[] = [];

    switch (criteria.scope) {
      case "titles":
        results = await this.fileManager.searchInTitle(
          criteria.query,
          searchOptions
        );
        break;
      case "content":
        results = await this.fileManager.searchInContent(criteria.query, {
          ...searchOptions,
          includeYaml: false,
        });
        break;
      case "both":
        const titleResults = await this.fileManager.searchInTitle(
          criteria.query,
          searchOptions
        );
        const contentResults = await this.fileManager.searchInContent(
          criteria.query,
          {
            ...searchOptions,
            includeYaml: false,
          }
        );

        // Merge results, removing duplicates based on file path
        const resultMap = new Map<string, ContentSearchResult>();

        // Add title results
        for (const result of titleResults) {
          resultMap.set(result.file.path, result);
        }

        // Add content results, combining scores if file already exists
        for (const result of contentResults) {
          const existing = resultMap.get(result.file.path);
          if (existing) {
            // Combine matches and scores
            existing.matches.push(...result.matches);
            existing.score += result.score;
          } else {
            resultMap.set(result.file.path, result);
          }
        }

        results = Array.from(resultMap.values());
        break;
      default:
        results = [];
    }

    // Sort by relevance score (highest first)
    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Check if a specific prompt file matches the search criteria
   */
  async matchesPrompt(
    prompt: PromptFile,
    criteria: SearchCriteria
  ): Promise<boolean> {
    const results = await this.search(criteria);
    return results.some((result) => result.file.path === prompt.path);
  }

  /**
   * Count total matches for search criteria
   */
  async countMatches(criteria: SearchCriteria): Promise<number> {
    const results = await this.search(criteria);
    return results.length;
  }

  /**
   * Fallback text matching for when enhanced search fails
   */
  matchesTextFallback(prompt: PromptFile, criteria: SearchCriteria): boolean {
    const query = criteria.caseSensitive
      ? criteria.query
      : criteria.query.toLowerCase();

    switch (criteria.scope) {
      case "titles":
        return this.matchesText(prompt.title, query, criteria.caseSensitive);
      case "content":
        // Search in description and tags as fallback
        const searchableContent = [
          prompt.description || "",
          ...(prompt.tags || []),
        ].join(" ");
        return this.matchesText(
          searchableContent,
          query,
          criteria.caseSensitive
        );
      case "both":
        return (
          this.matchesText(prompt.title, query, criteria.caseSensitive) ||
          this.matchesText(
            [prompt.description || "", ...(prompt.tags || [])].join(" "),
            query,
            criteria.caseSensitive
          )
        );
      default:
        return false;
    }
  }

  private matchesText(
    text: string,
    query: string,
    caseSensitive: boolean
  ): boolean {
    const searchText = caseSensitive ? text : text.toLowerCase();
    return searchText.includes(query);
  }
}
