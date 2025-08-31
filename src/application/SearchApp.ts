import * as vscode from "vscode";
import { injectable, inject } from "tsyringe";
import { SearchQuery } from "../domain/model/SearchQuery";
import { SearchEngine } from "./ports/SearchEngine";
import { PromptApp } from "./PromptApp";
import { SearchPromptFilter } from "./filters/SearchPromptFilter";
import { Indexer } from "./ports/Indexer";
import { DI_TOKENS } from "../infrastructure/di/di-tokens";

/**
 * Rich suggestion result with title and snippet
 */
export interface SuggestionResult {
  id: string;
  title: string;
  snippet: string;
}

/**
 * Application service for search operations
 */
@injectable()
export class SearchApp {
  private readonly _onSearchChanged: vscode.EventEmitter<void> =
    new vscode.EventEmitter<void>();
  public readonly onSearchChanged: vscode.Event<void> =
    this._onSearchChanged.event;

  private readonly _onResultsCountChanged: vscode.EventEmitter<number> =
    new vscode.EventEmitter<number>();
  public readonly onResultsCountChanged: vscode.Event<number> =
    this._onResultsCountChanged.event;

  private currentQuery: SearchQuery | null = null;
  private lastResults: Array<{
    id: string;
    score: number;
    matches: Record<string, string[]>;
  }> = [];

  constructor(
    @inject(DI_TOKENS.SearchEngine)
    private readonly searchEngine: SearchEngine,
    @inject(DI_TOKENS.PromptApp)
    private readonly promptApp: PromptApp,
    @inject(DI_TOKENS.SearchPromptFilter)
    private readonly searchFilter: SearchPromptFilter,
    @inject(DI_TOKENS.Indexer)
    private readonly indexer: Indexer
  ) {
    // Re-index when structure changes
    this.promptApp.onTreeChanged(async () => {
      if (this.currentQuery?.isActive) {
        await this.reindexAndSearch();
      }
    });
  }

  async setCriteria(criteria: SearchQuery): Promise<void> {
    this.currentQuery = criteria;
    this.searchFilter.setCriteria(criteria);
    if (criteria.isActive) {
      await this.reindexAndSearch();
    } else {
      this.lastResults = [];
      this._onResultsCountChanged.fire(0);
    }
    this._onSearchChanged.fire();
  }

  clear(): void {
    this.currentQuery = null;
    this.lastResults = [];
    this._onResultsCountChanged.fire(0);
    this._onSearchChanged.fire();
  }

  async suggest(criteria: SearchQuery): Promise<SuggestionResult[]> {
    if (!criteria.query.trim()) {
      return [];
    }

    const searchResults = this.searchEngine.search({
      ...criteria,
      maxSuggestions: 10,
    });

    // Convert search results to richer suggestion format
    const suggestions: SuggestionResult[] = [];
    for (const result of searchResults) {
      const title = await this.extractTitle(result.id);
      const snippet = await this.extractSnippet(result.id, criteria.query);

      suggestions.push({
        id: result.id,
        title,
        snippet,
      });
    }

    return suggestions;
  }

  getCurrentQuery(): SearchQuery | null {
    return this.currentQuery;
  }

  getResults(): Array<{
    id: string;
    score: number;
    matches: Record<string, string[]>;
  }> {
    return [...this.lastResults];
  }

  getResultsCount(): number {
    return this.lastResults.length;
  }

  private async reindexAndSearch(): Promise<void> {
    if (!this.currentQuery) {
      return;
    }

    // Index all current files from the raw (unfiltered) structure
    const raw = this.indexer.get() ?? (await this.indexer.build());
    const files = [
      ...raw.rootPrompts.map((p) => ({ path: p.path, content: "" })),
      ...raw.folders.flatMap((f) =>
        f.prompts.map((p) => ({ path: p.path, content: "" }))
      ),
    ];

    // Load content for all files
    const filesWithContent = await Promise.all(
      files.map(async (file) => ({
        path: file.path,
        content: await this.promptApp.copyContent(file.path, true),
      }))
    );

    await this.searchEngine.ensureIndexed(() =>
      Promise.resolve(filesWithContent)
    );

    // Perform search
    this.lastResults = this.searchEngine.search(this.currentQuery!);
    this._onResultsCountChanged.fire(this.lastResults.length);
  }

  /**
   * Extract title from a file
   */
  private async extractTitle(filePath: string): Promise<string> {
    try {
      const content = await this.promptApp.copyContent(filePath, true);

      // Extract title from frontmatter or first heading
      const lines = content.split("\n");
      let title = "";

      // Check for frontmatter title
      if (lines[0]?.trim() === "---") {
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i]?.trim();
          if (line === "---") {
            break;
          }
          if (line?.startsWith("title:")) {
            title = line.substring(6).trim();
            if (title.startsWith('"') && title.endsWith('"')) {
              title = title.slice(1, -1);
            }
            break;
          }
        }
      }

      // If no frontmatter title, look for first heading
      if (!title) {
        for (const line of lines) {
          if (line?.startsWith("# ")) {
            title = line.substring(2).trim();
            break;
          }
        }
      }

      return title || "Untitled";
    } catch (error) {
      // Fallback to filename if content can't be read
      return filePath.split("/").pop() || "Unknown";
    }
  }

  /**
   * Extract snippet from a file around the search query
   */
  private async extractSnippet(
    filePath: string,
    query: string
  ): Promise<string> {
    try {
      const content = await this.promptApp.copyContent(filePath, false); // Don't include frontmatter
      const lines = content.split("\n");

      // Find the first line containing the query (case insensitive)
      const queryLower = query.toLowerCase();
      for (const line of lines) {
        if (line.toLowerCase().includes(queryLower)) {
          // Return the line with some context, trimmed to reasonable length
          const snippet = line.trim();
          return snippet.length > 100
            ? snippet.substring(0, 97) + "..."
            : snippet;
        }
      }

      // If no exact match, return the first non-empty line
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) {
          return trimmed.length > 100
            ? trimmed.substring(0, 97) + "..."
            : trimmed;
        }
      }

      return "No preview available";
    } catch (error) {
      return "Preview unavailable";
    }
  }
}
