import { PromptParser, ParsedPromptContent } from "./PromptParser";
import { LRUCache } from "lru-cache";
import { trim } from "lodash";

export interface SearchCriteria {
  query: string;
  scope: "titles" | "content" | "both";
  caseSensitive?: boolean;
  exact?: boolean;
  includeYaml?: boolean;
  isActive: boolean;
}

export interface SearchMatch {
  type: "title" | "content" | "description" | "tags";
  position: number;
  length: number;
  context: string;
}

export interface SearchResult {
  filePath: string;
  fileName: string;
  title: string;
  score: number;
  matches: SearchMatch[];
  snippet?: string;
}

export interface SearchOptions {
  caseSensitive?: boolean;
  exact?: boolean;
  includeYaml?: boolean;
  maxResults?: number;
  contextSize?: number;
}

export interface FileContent {
  path: string;
  content: string;
  parsed?: ParsedPromptContent;
}

export class SearchEngine {
  private parser: PromptParser;
  private contentCache: LRUCache<string, ParsedPromptContent>;

  constructor() {
    this.parser = new PromptParser();
    this.contentCache = new LRUCache<string, ParsedPromptContent>({
      max: 500,
      ttl: 10 * 60 * 1000, // 10 minutes for parsed content
    });
  }

  /**
   * Execute search across file contents
   */
  public async searchFiles(
    files: FileContent[],
    criteria: SearchCriteria
  ): Promise<SearchResult[]> {
    if (!criteria.isActive || !trim(criteria.query)) {
      return [];
    }

    const results: SearchResult[] = [];
    const searchOptions = this.createSearchOptions(criteria);

    for (const file of files) {
      const searchResult = await this.searchSingleFile(
        file,
        criteria.query,
        searchOptions
      );

      if (searchResult && this.matchesScope(searchResult, criteria.scope)) {
        results.push(searchResult);
      }
    }

    // Sort by relevance score (highest first)
    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Search within a single file
   */
  public async searchSingleFile(
    file: FileContent,
    query: string,
    options: SearchOptions
  ): Promise<SearchResult | null> {
    try {
      // Get parsed content (cached if available)
      const parsed = this.getParsedContent(file);

      const matches: SearchMatch[] = [];

      // Search in title
      if (parsed.title) {
        const titleMatches = this.findTextMatches(
          parsed.title,
          query,
          "title",
          options
        );
        matches.push(...titleMatches);
      }

      // Search in description
      if (parsed.description) {
        const descMatches = this.findTextMatches(
          parsed.description,
          query,
          "description",
          options
        );
        matches.push(...descMatches);
      }

      // Search in tags
      if (parsed.tags.length > 0) {
        const tagsText = parsed.tags.join(" ");
        const tagMatches = this.findTextMatches(
          tagsText,
          query,
          "tags",
          options
        );
        matches.push(...tagMatches);
      }

      // Search in content body
      if (parsed.content) {
        const contentMatches = this.findTextMatches(
          parsed.content,
          query,
          "content",
          options
        );
        matches.push(...contentMatches);
      }

      // Search in YAML front matter if requested
      if (options.includeYaml && parsed.frontMatter) {
        const yamlText = JSON.stringify(parsed.frontMatter);
        const yamlMatches = this.findTextMatches(
          yamlText,
          query,
          "content",
          options
        );
        matches.push(...yamlMatches);
      }

      if (matches.length === 0) {
        return null;
      }

      const score = this.calculateSearchScore(matches, query);
      const snippet = this.createSearchSnippet(matches);

      return {
        filePath: file.path,
        fileName: this.getFileNameFromPath(file.path),
        title: parsed.title,
        score,
        matches,
        snippet,
      };
    } catch (error) {
      console.error(`Search failed for file ${file.path}:`, error);
      return null;
    }
  }

  /**
   * Simple text matching for fallback scenarios
   */
  public matchesTextFallback(
    text: string,
    query: string,
    options: SearchOptions = {}
  ): boolean {
    const searchText = options.caseSensitive ? text : text.toLowerCase();
    const searchQuery = options.caseSensitive ? query : query.toLowerCase();

    if (options.exact) {
      // Word boundary matching
      const regex = new RegExp(
        `\\b${this.escapeRegex(searchQuery)}\\b`,
        options.caseSensitive ? "g" : "gi"
      );
      return regex.test(searchText);
    } else {
      // Simple substring matching
      return searchText.includes(searchQuery);
    }
  }

  /**
   * Count matches for search criteria
   */
  public async countMatches(
    files: FileContent[],
    criteria: SearchCriteria
  ): Promise<number> {
    const results = await this.searchFiles(files, criteria);
    return results.length;
  }

  /**
   * Check if a specific file matches search criteria
   */
  public async fileMatches(
    file: FileContent,
    criteria: SearchCriteria
  ): Promise<boolean> {
    const searchOptions = this.createSearchOptions(criteria);
    const result = await this.searchSingleFile(
      file,
      criteria.query,
      searchOptions
    );
    return result !== null && this.matchesScope(result, criteria.scope);
  }

  /**
   * Clear search cache
   */
  public clearCache(): void {
    this.contentCache.clear();
  }

  // Private helper methods

  private getParsedContent(file: FileContent): ParsedPromptContent {
    const cacheKey = file.path;

    // Try to get from cache first
    let parsed = this.contentCache.get(cacheKey);

    if (!parsed) {
      // Parse and cache
      const fileName = this.getFileNameFromPath(file.path);
      parsed = this.parser.parsePromptContent(file.content, fileName);
      this.contentCache.set(cacheKey, parsed);
    }

    return parsed;
  }

  private createSearchOptions(criteria: SearchCriteria): SearchOptions {
    return {
      caseSensitive: criteria.caseSensitive || false,
      exact: criteria.exact || false,
      includeYaml: criteria.includeYaml || false,
      maxResults: 100,
      contextSize: 50,
    };
  }

  private matchesScope(
    result: SearchResult,
    scope: SearchCriteria["scope"]
  ): boolean {
    switch (scope) {
      case "titles":
        return result.matches.some(
          (m) => m.type === "title" || m.type === "description"
        );
      case "content":
        return result.matches.some((m) => m.type === "content");
      case "both":
        return true;
      default:
        return true;
    }
  }

  private findTextMatches(
    text: string,
    query: string,
    type: SearchMatch["type"],
    options: SearchOptions
  ): SearchMatch[] {
    const matches: SearchMatch[] = [];
    const searchQuery = options.caseSensitive ? query : query.toLowerCase();
    const searchText = options.caseSensitive ? text : text.toLowerCase();

    if (options.exact) {
      // Exact word matching
      const regex = new RegExp(`\\b${this.escapeRegex(searchQuery)}\\b`, "gi");
      let match;

      while ((match = regex.exec(searchText)) !== null) {
        matches.push({
          type,
          position: match.index,
          length: match[0].length,
          context: this.extractContext(
            text,
            match.index,
            match[0].length,
            options.contextSize || 50
          ),
        });
      }
    } else {
      // Fuzzy matching
      let startIndex = 0;
      while (true) {
        const index = searchText.indexOf(searchQuery, startIndex);
        if (index === -1) {
          break;
        }

        matches.push({
          type,
          position: index,
          length: searchQuery.length,
          context: this.extractContext(
            text,
            index,
            searchQuery.length,
            options.contextSize || 50
          ),
        });

        startIndex = index + 1;
      }
    }

    return matches;
  }

  private extractContext(
    text: string,
    position: number,
    length: number,
    contextSize: number
  ): string {
    const start = Math.max(0, position - contextSize);
    const end = Math.min(text.length, position + length + contextSize);

    let context = text.substring(start, end);

    // Add ellipsis if we're not at the beginning/end
    if (start > 0) {
      context = "..." + context;
    }
    if (end < text.length) {
      context = context + "...";
    }

    return context;
  }

  private calculateSearchScore(matches: SearchMatch[], query: string): number {
    let score = 0;

    for (const match of matches) {
      // Base score based on match type
      switch (match.type) {
        case "title":
          score += 100;
          break;
        case "description":
          score += 50;
          break;
        case "tags":
          score += 75;
          break;
        case "content":
          score += 25;
          break;
      }

      // Bonus for exact matches
      if (match.length === query.length) {
        score += 25;
      }

      // Bonus for matches at word boundaries
      if (match.context.includes(" " + query + " ")) {
        score += 15;
      }
    }

    return score;
  }

  private createSearchSnippet(matches: SearchMatch[]): string {
    // Get the highest scoring match for snippet
    const bestMatch = matches.reduce((best, current) =>
      this.getMatchTypeScore(current.type) > this.getMatchTypeScore(best.type)
        ? current
        : best
    );

    return bestMatch.context;
  }

  private getMatchTypeScore(type: SearchMatch["type"]): number {
    switch (type) {
      case "title":
        return 100;
      case "description":
        return 50;
      case "tags":
        return 75;
      case "content":
        return 25;
      default:
        return 0;
    }
  }

  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  private getFileNameFromPath(filePath: string): string {
    const parts = filePath.split(/[/\\]/);
    const fileName = parts[parts.length - 1];
    return fileName.replace(/\.md$/, "");
  }
}
