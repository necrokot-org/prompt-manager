import * as FlexSearch from "flexsearch";
import trim from "lodash-es/trim.js";
import {
  FileContent,
  getParsedContent,
  clearParseCache,
} from "@utils/parsePrompt";

export interface FuzzyOptions {
  enabled: boolean; // quick toggle
  distance?: 0 | 1 | 2 | 3; // FlexSearch threshold
  tokenizer?: "tolerant" | "forward" | "reverse" | "full";
  encoder?: "normalize" | "balance" | "advanced" | "extra" | "soundex";
  languagePreset?: "en" | "de" | "fr" | "es" | "it" | "pt" | "ru" | "zh"; // maps to /lang/*.js
  suggest?: boolean; // enable autocomplete style search
}

export interface SearchOptions {
  query: string; // raw query (Boolean syntax allowed)
  scope?: SearchScope; // search scope (preferred over fields)
  fields?: string[]; // subset of fields to search; default = all
  limit?: number; // max results (search & autocomplete)
  exact?: boolean; // exact vs. substring
  caseSensitive?: boolean; // toggle
  fuzzy?: FuzzyOptions; // replaces old boolean|number
  suggest?: boolean; // true → autocomplete mode
}

export interface SearchResult {
  id: string; // file path
  score: number; // flexsearch score normalized 0–1
  matches: Record<string, string[]>; // field → matched terms
  filePath: string; // for backward compatibility
  fileName: string; // for backward compatibility
  title: string; // for backward compatibility
  snippet?: string; // for backward compatibility
}

interface SearchableDocument {
  id: string;
  filePath: string;
  fileName: string;
  title: string;
  description: string;
  tags: string;
  content: string;
}

interface IndexConfig {
  tokenizer: "forward" | "strict";
  caseSensitive: boolean;
  encoder?: "normalize" | "balance" | "advanced" | "extra" | "soundex";
  fuzzyThreshold?: number;
}

export enum SearchScope {
  /** file name + front-matter title (legacy "titles" scope) */
  TITLES = "titles",
  /** markdown body + tags/front-matter (legacy "content" scope) */
  CONTENT = "content",
  /** every indexed field (legacy "both" scope) */
  ALL = "both",
}

export const ScopeFields: Record<SearchScope, readonly string[]> = {
  [SearchScope.TITLES]: ["fileName", "title"],
  [SearchScope.CONTENT]: ["content", "description", "tags"],
  [SearchScope.ALL]: ["fileName", "title", "description", "tags", "content"],
};

type _FlexSearchIndex = FlexSearch.Document<SearchableDocument, string[]>;

/**
 * Full-text search engine backed by FlexSearch.
 *
 * Simplified API with native FlexSearch features:
 * - Boolean operators (+, -, |, AND, OR, NOT)
 * - Case-sensitive search
 * - Fuzzy matching
 * - Autocomplete suggestions
 * - Two-index strategy (substring vs exact)
 */
export class FlexSearchService {
  // Four indexes to support combinations of case sensitivity and whole-word matching
  private ciForwardIndex: _FlexSearchIndex; // case-insensitive, substring
  private ciStrictIndex: _FlexSearchIndex; // case-insensitive, whole-word
  private csForwardIndex: _FlexSearchIndex; // case-sensitive, substring
  private csStrictIndex: _FlexSearchIndex; // case-sensitive, whole-word

  // Fuzzy indexes for fuzzy search
  private ciFuzzyIndex: _FlexSearchIndex; // case-insensitive, fuzzy
  private csFuzzyIndex: _FlexSearchIndex; // case-sensitive, fuzzy

  private indexedFiles: Map<string, SearchableDocument> = new Map();
  private isReady = false;

  constructor() {
    this.ciForwardIndex = this.createIndex({
      tokenizer: "forward",
      caseSensitive: false,
    });
    this.ciStrictIndex = this.createIndex({
      tokenizer: "strict",
      caseSensitive: false,
    });
    this.csForwardIndex = this.createIndex({
      tokenizer: "forward",
      caseSensitive: true,
    });
    this.csStrictIndex = this.createIndex({
      tokenizer: "strict",
      caseSensitive: true,
    });

    // Create fuzzy indexes with threshold
    this.ciFuzzyIndex = this.createIndex({
      tokenizer: "forward",
      caseSensitive: false,
      fuzzyThreshold: 3,
    });
    this.csFuzzyIndex = this.createIndex({
      tokenizer: "forward",
      caseSensitive: true,
      fuzzyThreshold: 3,
    });
  }

  /**
   * (Re)build all indexes from the given files
   */
  public async index(files: FileContent[]): Promise<void> {
    // Clear existing indexes by recreating them
    this.ciForwardIndex = this.createIndex({
      tokenizer: "forward",
      caseSensitive: false,
    });
    this.ciStrictIndex = this.createIndex({
      tokenizer: "strict",
      caseSensitive: false,
    });
    this.csForwardIndex = this.createIndex({
      tokenizer: "forward",
      caseSensitive: true,
    });
    this.csStrictIndex = this.createIndex({
      tokenizer: "strict",
      caseSensitive: true,
    });

    // Recreate fuzzy indexes
    this.ciFuzzyIndex = this.createIndex({
      tokenizer: "forward",
      caseSensitive: false,
      fuzzyThreshold: 3,
    });
    this.csFuzzyIndex = this.createIndex({
      tokenizer: "forward",
      caseSensitive: true,
      fuzzyThreshold: 3,
    });

    this.indexedFiles.clear();

    if (files.length === 0) {
      this.isReady = true;
      return;
    }

    // Add all files to all indexes
    for (const file of files) {
      const document = this.createSearchableDocument(file);
      this.indexedFiles.set(file.path, document);
      this.ciForwardIndex.add(document);
      this.ciStrictIndex.add(document);
      this.csForwardIndex.add(document);
      this.csStrictIndex.add(document);
      this.ciFuzzyIndex.add(document);
      this.csFuzzyIndex.add(document);
    }

    this.isReady = true;
  }

  /**
   * Ensure indexes are built exactly once. Accepts a callback that loads files lazily.
   */
  public async ensureIndexed(
    loader: () => Promise<FileContent[]>
  ): Promise<void> {
    if (this.isReady) {
      return;
    }
    const files = await loader();
    await this.index(files);
  }

  /**
   * Search with flexible options
   */
  public search(options: SearchOptions): SearchResult[] {
    if (!trim(options.query)) {
      return [];
    }

    const index = this.selectIndex(
      !!options.exact,
      !!options.caseSensitive,
      options.fuzzy
    );

    // Build search options
    const searchOptions = this.buildSearchOptions(options);

    // Perform search
    const results = index.search(options.query, searchOptions);

    // Normalize results
    const normalized = this.normalizeResults(results, options);

    // Apply limit
    const limited = normalized.slice(0, options.limit || 20);

    return limited;
  }

  /**
   * Clear all caches and indexes
   */
  public clearCache(): void {
    // Clear by recreating indexes
    this.ciForwardIndex = this.createIndex({
      tokenizer: "forward",
      caseSensitive: false,
    });
    this.ciStrictIndex = this.createIndex({
      tokenizer: "strict",
      caseSensitive: false,
    });
    this.csForwardIndex = this.createIndex({
      tokenizer: "forward",
      caseSensitive: true,
    });
    this.csStrictIndex = this.createIndex({
      tokenizer: "strict",
      caseSensitive: true,
    });

    // Recreate fuzzy indexes
    this.ciFuzzyIndex = this.createIndex({
      tokenizer: "forward",
      caseSensitive: false,
      fuzzyThreshold: 3,
    });
    this.csFuzzyIndex = this.createIndex({
      tokenizer: "forward",
      caseSensitive: true,
      fuzzyThreshold: 3,
    });

    this.indexedFiles.clear();
    clearParseCache();
    this.isReady = false;
  }

  // Add or update a single file in both indexes --------------------------------
  public upsertDocument(file: FileContent): void {
    const document = this.createSearchableDocument(file);

    // If the document already exists – remove first to avoid duplicates
    if (this.indexedFiles.has(file.path)) {
      this.ciForwardIndex.remove(file.path);
      this.ciStrictIndex.remove(file.path);
      this.csForwardIndex.remove(file.path);
      this.csStrictIndex.remove(file.path);
      this.ciFuzzyIndex.remove(file.path);
      this.csFuzzyIndex.remove(file.path);
    }

    this.ciForwardIndex.add(document);
    this.ciStrictIndex.add(document);
    this.csForwardIndex.add(document);
    this.csStrictIndex.add(document);
    this.ciFuzzyIndex.add(document);
    this.csFuzzyIndex.add(document);
    this.indexedFiles.set(file.path, document);
  }

  // Remove a single document from indexes --------------------------------------
  public removeDocument(filePath: string): void {
    if (!this.indexedFiles.has(filePath)) {
      return;
    }

    this.ciForwardIndex.remove(filePath);
    this.ciStrictIndex.remove(filePath);
    this.csForwardIndex.remove(filePath);
    this.csStrictIndex.remove(filePath);
    this.ciFuzzyIndex.remove(filePath);
    this.csFuzzyIndex.remove(filePath);
    this.indexedFiles.delete(filePath);
  }

  /**
   * Check if a single file matches the search criteria
   */
  public async matches(file: FileContent, criteria: any): Promise<boolean> {
    if (!trim(criteria.query)) {
      return false;
    }

    // Ensure the target document is indexed
    if (!this.indexedFiles.has(file.path)) {
      this.upsertDocument(file);
    }

    /*------------------------------------------------------------------
      Simpler: perform a regular search then check if the document
      appears in the results. This avoids the edge-cases we were seeing
      when combining  `field` + `where` filters inside FlexSearch.
    -------------------------------------------------------------------*/
    const hits = this.search({
      query: criteria.query,
      scope: criteria.scope,
      limit: 1000,
      exact: criteria.matchWholeWord,
      caseSensitive: criteria.caseSensitive,
      fuzzy: criteria.fuzzy,
      suggest: false,
    });

    return hits.some((r) => r.id === file.path);
  }

  // Private methods

  private mapScopeToFields(scope?: SearchScope): string[] {
    if (!scope) {
      return [...ScopeFields[SearchScope.ALL]];
    }
    return [...ScopeFields[scope]];
  }

  private createIndex(
    config: IndexConfig
  ): FlexSearch.Document<SearchableDocument, string[]> {
    let encoder: any;

    if (config.encoder) {
      // Use FlexSearch's built-in encoders
      encoder = config.encoder;
    } else {
      // Custom encoder: basic lower-case transformation to achieve case-insensitive search
      encoder = config.caseSensitive
        ? (str: string): string[] => str.split(/\s+/)
        : (str: string): string[] => str.toLowerCase().split(/\s+/);
    }

    const baseConfig: any = {
      encode: encoder,
      cache: true,
      tokenize: config.tokenizer,
      document: {
        id: "id",
        index: ["fileName", "title", "description", "tags", "content"],
        store: [
          "filePath",
          "fileName",
          "title",
          "description",
          "tags",
          "content",
        ],
      },
    };

    // Add threshold for fuzzy indexes
    if (config.fuzzyThreshold !== undefined) {
      baseConfig.threshold = config.fuzzyThreshold;
    }

    return new FlexSearch.Document(baseConfig);
  }

  private buildSearchOptions(options: SearchOptions): any {
    const searchOptions: any = {
      limit: options.limit || 20,
      suggest: !!options.suggest,
    };

    // Field filtering - prefer scope over explicit fields
    if (options.scope) {
      searchOptions.field = this.mapScopeToFields(options.scope);
    } else if (options.fields && options.fields.length > 0) {
      searchOptions.field = options.fields;
    }

    /*---------------------------------------------------------------
      Fuzzy handling with new FuzzyOptions interface:
        Threshold is set globally on the fuzzy indexes, not per search.
        Only handle the suggest option here.
    ---------------------------------------------------------------*/
    if (options.fuzzy?.enabled && options.fuzzy.suggest) {
      searchOptions.suggest = true;
    }

    return searchOptions;
  }

  private normalizeResults(
    results: any,
    options: SearchOptions
  ): SearchResult[] {
    if (!results || results.length === 0) {
      return [];
    }

    const raw: SearchResult[] = [];

    // FlexSearch returns different formats depending on the query type
    // Handle:
    // 1. Array of ids (string)
    // 2. Array of objects per result id
    // 3. Array of objects with shape { field, result: [ids...] }
    const resultItems = Array.isArray(results) ? results : [results];

    for (const result of resultItems) {
      if (!result) {
        continue;
      }

      if (typeof result === "string") {
        const document = this.indexedFiles.get(result);
        if (document) {
          raw.push(this.createSearchResult(document, {}, options));
        }
        continue;
      }

      // Result object may be { id, field, result } or { field, result }
      if (Array.isArray(result.result)) {
        const fieldName = result.field;
        for (const id of result.result) {
          const document = this.indexedFiles.get(id);
          if (document) {
            const matches = fieldName ? { [fieldName]: [options.query] } : {};
            raw.push(this.createSearchResult(document, matches, options));
          }
        }
        continue;
      }

      // Fallback object with id property
      if (result.id) {
        const document = this.indexedFiles.get(result.id);
        if (document) {
          const matches = this.extractMatches(result, options.query);
          raw.push(this.createSearchResult(document, matches, options));
        }
      }
    }

    /*---------------------------------------------------------------
      1. De-duplicate results that were returned once per matching
         field (e.g. fileName + title).
      2. Merge match-info & keep the highest score.
      3. Sort descending by score so callers get a ranked list.
    ---------------------------------------------------------------*/
    const map = new Map<string, SearchResult>();
    for (const res of raw) {
      const existing = map.get(res.id);
      if (!existing) {
        map.set(res.id, { ...res });
        continue;
      }
      // merge matches
      for (const [field, terms] of Object.entries(res.matches)) {
        existing.matches[field] = Array.from(
          new Set([...(existing.matches[field] || []), ...terms])
        );
      }
      existing.score = Math.max(existing.score, res.score);
    }

    return Array.from(map.values()).sort((a, b) => b.score - a.score);
  }

  private createSearchResult(
    document: SearchableDocument,
    matches: Record<string, string[]>,
    options: SearchOptions
  ): SearchResult {
    // Calculate a normalized score (0-1 range)
    const score = this.calculateScore(document, options.query);

    // Create snippet for backward compatibility
    const snippet = this.createSnippet(document, options.query);

    return {
      id: document.id,
      score,
      matches,
      filePath: document.filePath,
      fileName: document.fileName,
      title: document.title,
      snippet,
    };
  }

  private extractMatches(result: any, query: string): Record<string, string[]> {
    const matches: Record<string, string[]> = {};

    // FlexSearch might provide match information
    if (result.field) {
      matches[result.field] = [query];
    } else {
      // Default to content matches
      matches.content = [query];
    }

    return matches;
  }

  private calculateScore(document: SearchableDocument, query: string): number {
    // Simple scoring based on where the query appears
    const queryLower = query.toLowerCase();
    let score = 0;

    // Title matches get highest score
    if (document.title.toLowerCase().includes(queryLower)) {
      score += 0.4;
    }

    // Description matches get medium score
    if (document.description.toLowerCase().includes(queryLower)) {
      score += 0.3;
    }

    // Tag matches get medium score
    if (document.tags.toLowerCase().includes(queryLower)) {
      score += 0.2;
    }

    // Content matches get base score
    if (document.content.toLowerCase().includes(queryLower)) {
      score += 0.1;
    }

    return Math.min(1, score);
  }

  private createSnippet(document: SearchableDocument, query: string): string {
    const queryLower = query.toLowerCase();

    // Try to find the query in the content and extract context
    const content = document.content.toLowerCase();
    const queryIndex = content.indexOf(queryLower);

    if (queryIndex >= 0) {
      const contextSize = 50;
      const start = Math.max(0, queryIndex - contextSize);
      const end = Math.min(
        document.content.length,
        queryIndex + query.length + contextSize
      );

      let snippet = document.content.slice(start, end);

      // Add ellipsis if needed
      if (start > 0) {
        snippet = "..." + snippet;
      }
      if (end < document.content.length) {
        snippet = snippet + "...";
      }

      return snippet.trim();
    }

    // Fallback to title or description
    return document.title || document.description || "";
  }

  private createSearchableDocument(file: FileContent): SearchableDocument {
    const parsed = getParsedContent(file);
    const fileName = file.path.split("/").pop() || file.path;

    return {
      id: file.path,
      filePath: file.path,
      fileName,
      title: parsed.title,
      description: parsed.description || "",
      tags: parsed.tags.join(" "),
      content: parsed.content,
    };
  }

  /** Choose appropriate index based on flags */
  private selectIndex(
    matchWholeWord: boolean,
    caseSensitive: boolean,
    fuzzy?: FuzzyOptions
  ) {
    // If fuzzy search is enabled, use fuzzy indexes
    if (fuzzy?.enabled) {
      return caseSensitive ? this.csFuzzyIndex : this.ciFuzzyIndex;
    }

    // Otherwise use exact indexes
    if (caseSensitive) {
      return matchWholeWord ? this.csStrictIndex : this.csForwardIndex;
    } else {
      return matchWholeWord ? this.ciStrictIndex : this.ciForwardIndex;
    }
  }
}
