import { PromptParser, ParsedPromptContent } from "./PromptParser";
import { LRUCache } from "lru-cache";
import { trim } from "lodash";
import Fuse, { IFuseOptions, FuseResult } from "fuse.js";

export interface SearchCriteria {
  query: string;
  scope: "titles" | "content" | "both";
  caseSensitive?: boolean;
  exact?: boolean;
  threshold?: number; // Expose fuse.js threshold directly
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

export interface FileContent {
  path: string;
  content: string;
  parsed?: ParsedPromptContent;
}

interface SearchableContent {
  filePath: string;
  fileName: string;
  parsed: ParsedPromptContent;
  fullContent: string;
}

export class SearchEngine {
  private parser: PromptParser;
  private contentCache: LRUCache<string, ParsedPromptContent>;
  private searchableContent: SearchableContent[] = [];
  private fuse: Fuse<SearchableContent> | null = null;
  private lastIndexTime = 0;
  private readonly INDEX_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.parser = new PromptParser();
    this.contentCache = new LRUCache<string, ParsedPromptContent>({
      max: 500,
      ttl: 10 * 60 * 1000, // 10 minutes for parsed content
    });
  }

  /**
   * Execute search across file contents using fuse.js
   */
  public async search(
    files: FileContent[],
    criteria: SearchCriteria
  ): Promise<SearchResult[]> {
    if (!criteria.isActive || !trim(criteria.query)) {
      return [];
    }

    // Build or refresh the search index if needed
    await this.ensureIndex(files);

    if (!this.fuse) {
      return [];
    }

    // Configure fuse search options based on criteria
    const fuseOptions: IFuseOptions<SearchableContent> = {
      threshold: criteria.threshold ?? (criteria.exact ? 0.0 : 0.3),
      includeMatches: true,
      includeScore: true,
      ignoreLocation: true,
      keys: this.getSearchKeys(criteria.scope),
      isCaseSensitive: criteria.caseSensitive || false,
    };

    // Create a new fuse instance with updated options for this search
    const searchFuse = new Fuse(this.searchableContent, fuseOptions);

    // Perform the search
    const fuseResults = searchFuse.search(criteria.query);

    // Convert fuse results to our SearchResult format
    const searchResults: SearchResult[] = [];

    for (const fuseResult of fuseResults) {
      const item = fuseResult.item;
      const score = this.convertFuseScore(fuseResult.score || 0);
      const matches = this.extractMatches(fuseResult, criteria.query);
      const snippet = this.createSnippet(matches);

      searchResults.push({
        filePath: item.filePath,
        fileName: item.fileName,
        title: item.parsed.title,
        score,
        matches,
        snippet,
      });
    }

    return searchResults;
  }

  /**
   * Check if a specific file matches search criteria
   */
  public async matches(
    file: FileContent,
    criteria: SearchCriteria
  ): Promise<boolean> {
    if (!criteria.isActive || !trim(criteria.query)) {
      return false;
    }

    const result = await this.searchSingle(file, criteria);
    return result !== null;
  }

  /**
   * Search within a single file
   */
  public async searchSingle(
    file: FileContent,
    criteria: SearchCriteria
  ): Promise<SearchResult | null> {
    if (!criteria.isActive || !trim(criteria.query)) {
      return null;
    }

    // Create a temporary searchable content for this file
    const parsed = this.getParsedContent(file);
    const searchableContent: SearchableContent = {
      filePath: file.path,
      fileName: this.getFileNameFromPath(file.path),
      parsed,
      fullContent: file.content,
    };

    // Create a temporary fuse instance for single file search
    const fuseOptions: IFuseOptions<SearchableContent> = {
      threshold: criteria.threshold ?? (criteria.exact ? 0.0 : 0.3),
      includeMatches: true,
      includeScore: true,
      ignoreLocation: true,
      keys: this.getSearchKeys(criteria.scope),
      isCaseSensitive: criteria.caseSensitive || false,
    };

    const fuse = new Fuse([searchableContent], fuseOptions);
    const results = fuse.search(criteria.query);

    if (results.length === 0) {
      return null;
    }

    const fuseResult = results[0];
    const score = this.convertFuseScore(fuseResult.score || 0);
    const matches = this.extractMatches(fuseResult, criteria.query);
    const snippet = this.createSnippet(matches);

    return {
      filePath: file.path,
      fileName: this.getFileNameFromPath(file.path),
      title: parsed.title,
      score,
      matches,
      snippet,
    };
  }

  /**
   * Count matches for search criteria
   */
  public async count(
    files: FileContent[],
    criteria: SearchCriteria
  ): Promise<number> {
    const results = await this.search(files, criteria);
    return results.length;
  }

  /**
   * Clear all caches and indices
   */
  public clearCache(): void {
    this.contentCache.clear();
    this.searchableContent = [];
    this.fuse = null;
    this.lastIndexTime = 0;
  }

  /**
   * Get available search scopes
   */
  public getAvailableScopes(): Array<SearchCriteria["scope"]> {
    return ["titles", "content", "both"];
  }

  // Private helper methods

  private getParsedContent(file: FileContent): ParsedPromptContent {
    if (file.parsed) {
      return file.parsed;
    }

    const cacheKey = `${file.path}-${file.content.length}`;
    const cached = this.contentCache.get(cacheKey);

    if (cached) {
      return cached;
    }

    const fileName = this.getFileNameFromPath(file.path);
    const parsed = this.parser.parsePromptContent(file.content, fileName);
    this.contentCache.set(cacheKey, parsed);
    return parsed;
  }

  private async ensureIndex(files: FileContent[]): Promise<void> {
    const now = Date.now();

    // Check if we need to rebuild the index
    if (
      this.fuse &&
      this.searchableContent.length === files.length &&
      now - this.lastIndexTime < this.INDEX_TTL
    ) {
      return; // Index is still valid
    }

    // Build searchable content
    this.searchableContent = [];

    for (const file of files) {
      const parsed = this.getParsedContent(file);
      this.searchableContent.push({
        filePath: file.path,
        fileName: this.getFileNameFromPath(file.path),
        parsed,
        fullContent: file.content,
      });
    }

    // Create the fuse index with default configuration
    this.fuse = new Fuse(this.searchableContent, {
      threshold: 0.3,
      includeMatches: true,
      includeScore: true,
      ignoreLocation: true,
      keys: this.getAllSearchKeys(),
    });

    this.lastIndexTime = now;
  }

  private getSearchKeys(
    scope: SearchCriteria["scope"]
  ): Array<{ name: string; weight: number }> {
    switch (scope) {
      case "titles":
        return [
          { name: "parsed.title", weight: 0.6 },
          { name: "parsed.description", weight: 0.4 },
        ];
      case "content":
        return [
          { name: "parsed.content", weight: 0.7 },
          { name: "parsed.tags", weight: 0.3 },
        ];
      case "both":
      default:
        return this.getAllSearchKeys();
    }
  }

  private getAllSearchKeys(): Array<{ name: string; weight: number }> {
    return [
      { name: "parsed.title", weight: 0.4 },
      { name: "parsed.description", weight: 0.3 },
      { name: "parsed.tags", weight: 0.2 },
      { name: "parsed.content", weight: 0.1 },
    ];
  }

  private convertFuseScore(fuseScore: number): number {
    // Fuse scores are 0-1 where 0 is perfect match, 1 is no match
    // Convert to our scoring system where higher is better
    return Math.round((1 - fuseScore) * 100);
  }

  private extractMatches(
    fuseResult: FuseResult<SearchableContent>,
    query: string
  ): SearchMatch[] {
    const matches: SearchMatch[] = [];

    if (!fuseResult.matches) {
      return matches;
    }

    for (const match of fuseResult.matches) {
      if (!match.indices || match.indices.length === 0) {
        continue;
      }

      // Map fuse key to our match type
      const type = this.mapFuseKeyToMatchType(match.key || "");

      for (const [start, end] of match.indices) {
        const matchLength = end - start + 1;
        const context = this.extractContext(
          match.value || "",
          start,
          matchLength,
          50
        );

        matches.push({
          type,
          position: start,
          length: matchLength,
          context,
        });
      }
    }

    return matches;
  }

  private mapFuseKeyToMatchType(fuseKey: string): SearchMatch["type"] {
    if (fuseKey.includes("title")) {
      return "title";
    }
    if (fuseKey.includes("description")) {
      return "description";
    }
    if (fuseKey.includes("tags")) {
      return "tags";
    }
    if (fuseKey.includes("content")) {
      return "content";
    }
    return "content"; // fallback
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

    // Add ellipsis if we truncated
    if (start > 0) {
      context = "..." + context;
    }
    if (end < text.length) {
      context = context + "...";
    }

    return context;
  }

  private createSnippet(matches: SearchMatch[]): string {
    if (matches.length === 0) {
      return "";
    }

    // Get the highest priority match for snippet
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
        return 75;
      case "tags":
        return 50;
      case "content":
        return 25;
      default:
        return 0;
    }
  }

  private getFileNameFromPath(filePath: string): string {
    return filePath.split("/").pop() || filePath;
  }
}
