import {
  parsePromptContentSync,
  ParsedPromptContent,
} from "@root/validation/schemas/prompt";
import { LRUCache } from "lru-cache";
import trim from "lodash-es/trim.js";
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
  private contentCache: LRUCache<string, ParsedPromptContent>;
  private searchableContent: SearchableContent[] = [];
  private fuse: Fuse<SearchableContent> | null = null;
  private lastIndexTime = 0;
  private readonly INDEX_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
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

      // For exact matches, be very strict about what we accept
      if (criteria.exact) {
        // Only accept perfect matches (score must be 1.0 or very close)
        if (score < 0.99) {
          continue;
        }

        // Additional check: ensure the query appears as exact text in searchable fields
        const searchText = this.getSearchableText(item, criteria.scope);
        const queryToCheck = criteria.caseSensitive
          ? criteria.query
          : criteria.query.toLowerCase();
        const textToCheck = criteria.caseSensitive
          ? searchText
          : searchText.toLowerCase();

        // Check for exact word matches (not just substring)
        const wordBoundaryRegex = new RegExp(
          `\\b${this.escapeRegExp(queryToCheck)}\\b`
        );
        if (!wordBoundaryRegex.test(textToCheck)) {
          continue;
        }
      }

      const matches = this.extractMatches(fuseResult, criteria.query);
      const snippet = this.createSnippet(matches, criteria.query);

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
    const snippet = this.createSnippet(matches, criteria.query);

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
    const parsedContent = parsePromptContentSync(file.content, fileName);

    // Convert to legacy interface for backward compatibility
    const parsed: ParsedPromptContent = {
      frontMatter: parsedContent.frontMatter || {},
      content: parsedContent.content,
      title: parsedContent.title || fileName.replace(/-/g, " "),
      description: parsedContent.description,
      tags: parsedContent.tags || [],
    };

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
        return [{ name: "parsed.title", weight: 1.0 }];
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
    // Convert to our scoring system where higher is better (0-1 range)
    return Math.max(0, Math.min(1, 1 - fuseScore));
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
    // Ensure we capture the full matched word and surrounding context
    let start = Math.max(0, position - contextSize);
    let end = Math.min(text.length, position + length + contextSize);

    // Extend to word boundaries to avoid cutting off words
    while (start > 0 && /\w/.test(text[start - 1])) {
      start--;
    }
    while (end < text.length && /\w/.test(text[end])) {
      end++;
    }

    let context = text.substring(start, end);

    // Add ellipsis if we truncated
    if (start > 0) {
      context = "..." + context;
    }
    if (end < text.length) {
      context = context + "...";
    }

    return context.trim();
  }

  private createSnippet(matches: SearchMatch[], query?: string): string {
    if (matches.length === 0) {
      return "";
    }

    // 1️⃣ Prefer a match whose context contains the literal query text prominently
    if (query && query.length > 0) {
      const q = query.toLowerCase();

      // First, try to find a match where the query appears early in the context
      const prominentMatch = matches.find((m) => {
        const context = m.context.toLowerCase();
        const queryIndex = context.indexOf(q);
        // Query should appear in first 50 characters of the context for prominence
        return queryIndex >= 0 && queryIndex <= 50;
      });

      if (prominentMatch) {
        return prominentMatch.context;
      }

      // Fallback to any match that contains the query
      const anyMatch = matches.find((m) => m.context.toLowerCase().includes(q));
      if (anyMatch) {
        return anyMatch.context;
      }
    }

    // 2️⃣ Fallback - highest-priority field-type
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

  private getSearchableText(
    item: SearchableContent,
    scope: SearchCriteria["scope"]
  ): string {
    switch (scope) {
      case "titles":
        return item.parsed.title; // Only search titles, not description
      case "content":
        return item.parsed.content + " " + item.parsed.tags.join(" ");
      case "both":
        return (
          item.parsed.title +
          " " +
          item.parsed.description +
          " " +
          item.parsed.content +
          " " +
          item.parsed.tags.join(" ")
        );
      default:
        return "";
    }
  }

  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
