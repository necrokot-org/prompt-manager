import {
  parsePromptContentSync,
  ParsedPromptContent,
} from "@root/validation/schemas/prompt";
import { LRUCache } from "lru-cache";
import trim from "lodash-es/trim.js";
import MiniSearch, {
  Options,
  Suggestion,
  SearchResult as MiniSearchResult,
} from "minisearch";
import { SearchCriteria } from "@features/search/types/SearchCriteria";

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

interface Searchable {
  id: string;
  filePath: string;
  fileName: string;
  title: string;
  description: string;
  tags: string;
  content: string;
}

// Scope configuration to eliminate duplication between getSearchFields and getFieldBoosts
const SCOPE_CONFIG = {
  titles: {
    fields: ["title"] as string[],
    boosts: { title: 5 },
  },
  content: {
    fields: ["content", "tags"] as string[],
    boosts: { content: 1, tags: 2 },
  },
  both: {
    fields: ["title", "description", "tags", "content"] as string[],
    boosts: { title: 5, description: 3, tags: 2, content: 1 },
  },
};

export class MiniSearchEngine {
  private contentCache: LRUCache<string, ParsedPromptContent>;
  private index: MiniSearch<Searchable> | null = null;
  private lastBuild = 0;
  private readonly TTL = 5 * 60_000; // 5 minutes

  constructor() {
    this.contentCache = new LRUCache<string, ParsedPromptContent>({
      max: 500,
      ttl: 10 * 60 * 1000, // 10 minutes for parsed content
    });
  }

  /**
   * Execute search across file contents using MiniSearch
   */
  public async search(
    files: FileContent[],
    criteria: SearchCriteria
  ): Promise<SearchResult[]> {
    if (!criteria.isActive || !trim(criteria.query)) {
      return [];
    }

    await this.ensureIndex(files, criteria.scope);

    if (!this.index) {
      return [];
    }

    // Configure MiniSearch options based on criteria
    const searchOptions = this.buildSearchOptions(criteria);

    // Perform the search
    const hits = this.index.search(criteria.query, searchOptions);

    // Convert MiniSearch results to our SearchResult format
    let results = hits.map((hit) => this.mapHit(hit, criteria.query));

    // Apply explicit case-sensitive filtering, since MiniSearch does not natively support it
    if (criteria.caseSensitive) {
      const q = criteria.query;
      const matcher = (text: string | undefined) =>
        typeof text === "string" && text.includes(q);

      results = results.filter((r) => {
        if (matcher(r.title) || matcher(r.snippet) || matcher(r.fileName)) {
          return true;
        }
        // Fallback: check matches contexts for exact case
        return r.matches.some((m) => matcher(m.context));
      });
    }

    return results;
  }

  /**
   * Get autocomplete suggestions
   */
  public async autocomplete(
    files: FileContent[],
    criteria: SearchCriteria
  ): Promise<Suggestion[]> {
    if (!trim(criteria.query)) {
      return [];
    }

    await this.ensureIndex(files, criteria.scope);

    if (!this.index) {
      return [];
    }

    return this.index
      .autoSuggest(criteria.query, {
        fuzzy: criteria.fuzzy ? 0.2 : false,
        prefix: true,
        fields: this.getSearchFields(criteria.scope),
      })
      .slice(0, criteria.maxSuggestions ?? 5);
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

    // Create a temporary index for single file search
    const parsed = this.getParsedContent(file);
    const searchable = this.createSearchableContent(file, parsed);

    const tempIndex = new MiniSearch({
      fields: ["title", "description", "tags", "content"],
      storeFields: ["filePath", "fileName", "title"],
      searchOptions: {
        boost: this.getFieldBoosts(criteria.scope),
      },
      processTerm: (term) => {
        const lower = term.toLowerCase();
        return lower === term ? term : [term, lower];
      },
    });

    tempIndex.add(searchable);

    const searchOptions = this.buildSearchOptions(criteria);

    const results = tempIndex.search(criteria.query, searchOptions);

    if (results.length === 0) {
      return null;
    }

    let mapped = this.mapHit(results[0], criteria.query);
    if (criteria.caseSensitive) {
      const q = criteria.query;
      const matcher = (text: string | undefined) =>
        typeof text === "string" && text.includes(q);
      return matcher(mapped.title) ||
        matcher(mapped.snippet) ||
        matcher(mapped.fileName)
        ? mapped
        : null;
    }

    return mapped;
  }

  /**
   * Clear all caches and indices
   */
  public clearCache(): void {
    this.contentCache.clear();
    this.index = null;
    this.lastBuild = 0;
  }

  // Private helper methods

  /**
   * Build search options object to avoid duplication between search methods
   */
  private buildSearchOptions(criteria: SearchCriteria) {
    const options: any = {
      prefix: !criteria.caseSensitive,
      fuzzy: criteria.fuzzy ? 0.2 : false,
      combineWith: "AND" as const,
      fields: this.getSearchFields(criteria.scope),
      boost: this.getFieldBoosts(criteria.scope),
    };

    // For case-sensitive queries, do NOT lowercase the search term; for
    // case-insensitive queries, lowercase everything so we only search using
    // the lowercase variant (avoids AND issues when the term contains mixed
    // cases).
    if (criteria.caseSensitive) {
      options.processTerm = (term: string) => term;
    } else {
      options.processTerm = (term: string) => term.toLowerCase();
    }

    return options;
  }

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

  private async ensureIndex(
    files: FileContent[],
    scope: SearchCriteria["scope"]
  ): Promise<void> {
    const now = Date.now();

    // Check if we need to rebuild the index
    if (
      this.index &&
      this.index.documentCount === files.length &&
      now - this.lastBuild < this.TTL
    ) {
      return; // Index is still valid
    }

    // Create new MiniSearch index
    this.index = new MiniSearch({
      fields: ["title", "description", "tags", "content"],
      storeFields: ["filePath", "fileName", "title"],
      searchOptions: {
        boost: this.getFieldBoosts(scope),
      },
      processTerm: (term) => {
        const lower = term.toLowerCase();
        return lower === term ? term : [term, lower];
      },
    });

    // Add documents to the index
    for (const file of files) {
      const parsed = this.getParsedContent(file);
      const searchable = this.createSearchableContent(file, parsed);
      this.index.add(searchable);
    }

    this.lastBuild = now;
  }

  private createSearchableContent(
    file: FileContent,
    parsed: ParsedPromptContent
  ): Searchable {
    const fileName = this.getFileNameFromPath(file.path);
    // Add additional searchable tokens (slug title and base filename) to content to improve matching of concatenated queries like "newfile" without polluting tags.
    const slugTitle = parsed.title.replace(/\s+/g, "");
    const fileBaseName = fileName.replace(/\.[^/.]+$/, "");
    const augmentedContent = `${parsed.content}\n${slugTitle}\n${fileBaseName}`;

    return {
      id: file.path, // Use file path as unique ID
      filePath: file.path,
      fileName,
      title: parsed.title,
      description: parsed.description || "",
      tags: parsed.tags.join(" "),
      content: augmentedContent,
    };
  }

  private getSearchFields(scope: SearchCriteria["scope"]): string[] {
    const config = SCOPE_CONFIG[scope] || SCOPE_CONFIG.both;
    return config.fields;
  }

  private getFieldBoosts(
    scope: SearchCriteria["scope"]
  ): Record<string, number> {
    const config = SCOPE_CONFIG[scope] || SCOPE_CONFIG.both;
    return config.boosts;
  }

  private mapHit(hit: MiniSearchResult, query: string): SearchResult {
    const fileName = this.getFileNameFromPath(hit.id);

    // Extract matches from MiniSearch result
    const matches = this.extractMatches(hit, query);
    const snippet = this.createSnippet(matches, query);

    return {
      filePath: hit.id,
      fileName,
      title: hit.title || fileName.replace(/-/g, " "),
      score: this.convertMiniSearchScore(hit.score),
      matches,
      snippet,
    };
  }

  private extractMatches(hit: MiniSearchResult, query: string): SearchMatch[] {
    const matches: SearchMatch[] = [];

    // MiniSearch provides match info in the hit.match property
    if (hit.match) {
      for (const field in hit.match) {
        const fieldMatches = hit.match[field];
        if (Array.isArray(fieldMatches)) {
          for (const term of fieldMatches) {
            const type = this.mapFieldToMatchType(field);
            const context = this.extractContext(
              hit[field] || "",
              0,
              term.length,
              50
            );

            matches.push({
              type,
              position: 0, // MiniSearch doesn't provide exact positions
              length: term.length,
              context,
            });
          }
        }
      }
    }

    // Fallback: create a simple match if no detailed match info
    if (matches.length === 0) {
      matches.push({
        type: "content",
        position: 0,
        length: query.length,
        context: this.extractContext(
          hit.content || hit.title || "",
          0,
          query.length,
          50
        ),
      });
    }

    return matches;
  }

  private mapFieldToMatchType(field: string): SearchMatch["type"] {
    switch (field) {
      case "title":
        return "title";
      case "description":
        return "description";
      case "tags":
        return "tags";
      case "content":
      default:
        return "content";
    }
  }

  private convertMiniSearchScore(score: number): number {
    // MiniSearch scores are already in a good range (higher is better)
    // Just normalize to 0-1 range
    return Math.max(0, Math.min(1, score / 10));
  }

  private createSnippet(matches: SearchMatch[], query?: string): string {
    if (matches.length === 0) {
      return "";
    }

    // Prefer a match whose context contains the literal query text prominently
    if (query && query.length > 0) {
      const q = query.toLowerCase();

      // First, try to find a match where the query appears early in the context
      const prominentMatch = matches.find((m) => {
        const context = m.context.toLowerCase();
        const queryIndex = context.indexOf(q);
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

    // Fallback - highest-priority field-type
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
        return 4;
      case "description":
        return 3;
      case "tags":
        return 2;
      case "content":
        return 1;
      default:
        return 0;
    }
  }

  private extractContext(
    text: string,
    position: number,
    length: number,
    contextSize: number
  ): string {
    const start = Math.max(0, position - contextSize);
    const end = Math.min(text.length, position + length + contextSize);

    let context = text.slice(start, end);

    // Add ellipsis if we're not at the beginning or end
    if (start > 0) {
      context = "..." + context;
    }
    if (end < text.length) {
      context = context + "...";
    }

    return context.trim();
  }

  private getFileNameFromPath(filePath: string): string {
    return filePath.split("/").pop() || filePath;
  }
}
