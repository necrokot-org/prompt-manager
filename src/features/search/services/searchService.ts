import { injectable, inject } from "tsyringe";
import {
  FileManager,
  ContentSearchResult,
  SearchMatch,
  PromptFile,
} from "@features/prompt-manager/data/fileManager";
import { SearchCriteria } from "@features/search/types/SearchCriteria";
import {
  FlexSearchService,
  FuzzyOptions,
  SearchOptions,
  SearchScope,
} from "@features/search/core/FlexSearchService";
import { SearchSuggestion } from "@features/search/types/SearchSuggestion";
import { FileContent } from "@utils/parsePrompt";
import { eventBus, ExtensionSubscription } from "@infra/vscode/ExtensionBus";
import { log } from "@infra/vscode/log";
import { DI_TOKENS } from "@infra/di/di-tokens";
import trim from "lodash-es/trim.js";
import { searchResultToPromptFile } from "@features/search/utils/promptFile";

@injectable()
export class SearchService {
  private fileManager: FileManager;
  private engine: FlexSearchService;
  private disposables: ExtensionSubscription[] = [];

  constructor(@inject(DI_TOKENS.FileManager) fileManager: FileManager) {
    this.fileManager = fileManager;
    this.engine = new FlexSearchService();

    // Listen to filesystem changes and update search index automatically
    const subFileCreated = eventBus.on(
      "filesystem.file.created",
      async ({ filePath }) => {
        await this.handleFileAddOrChange(filePath);
      }
    );
    const subFileChanged = eventBus.on(
      "filesystem.file.changed",
      async ({ filePath }) => {
        await this.handleFileAddOrChange(filePath);
      }
    );
    const subResourceDeleted = eventBus.on(
      "filesystem.resource.deleted",
      ({ path }) => {
        this.engine.removeDocument(path);
      }
    );

    this.disposables.push(subFileCreated, subFileChanged, subResourceDeleted);
  }

  /** Ensure the global index is built once */
  private async ensureIndexBuilt(): Promise<void> {
    await this.engine.ensureIndexed(() => this.getFileContentsForSearch());
  }

  /** Handle single file add/change */
  private async handleFileAddOrChange(filePath: string): Promise<void> {
    try {
      const content = await this.fileManager
        .getFileSystemManager()
        .readFile(filePath);

      this.engine.upsertDocument({ path: filePath, content });
      // Mark initialised so subsequent searches don't trigger full build
      // engine will mark not ready
    } catch (error) {
      log.warn(`Failed to update search index for ${filePath}`, error);
    }
  }

  /**
   * Centralized search method using FlexSearch
   */
  async search(criteria: SearchCriteria): Promise<ContentSearchResult[]> {
    if (!criteria.isActive || !trim(criteria.query)) {
      return [];
    }

    // Make sure index is ready (built once, then kept hot)
    await this.ensureIndexBuilt();

    // Convert SearchCriteria to SearchOptions
    const searchOptions: SearchOptions = {
      query: criteria.query,
      limit: 100,
      exact: criteria.matchWholeWord,
      caseSensitive: criteria.caseSensitive,
      fuzzy: criteria.fuzzy,
      suggest: false,
      scope: criteria.scope,
    };

    // Use FlexSearchService
    const results = this.engine.search(searchOptions);

    // Convert SearchResult[] to ContentSearchResult[]
    const contentResults: ContentSearchResult[] = [];
    for (const result of results) {
      const file = await this.convertSearchResultToPromptFile(result);
      contentResults.push({
        file,
        score: result.score,
        matches: this.convertMatches(result.matches),
      });
    }

    // Publish search results updated event
    await this.publishResultsUpdated(contentResults.length, criteria.query);

    return contentResults;
  }

  /**
   * Get autocomplete suggestions
   */
  async getSuggestions(criteria: SearchCriteria): Promise<SearchSuggestion[]> {
    if (!trim(criteria.query)) {
      return [];
    }

    await this.ensureIndexBuilt();

    // Convert SearchCriteria to SearchOptions for suggestions
    const searchOptions: SearchOptions = {
      query: criteria.query,
      limit: criteria.maxSuggestions || 5,
      exact: false,
      caseSensitive: criteria.caseSensitive,
      fuzzy: criteria.fuzzy ? { ...criteria.fuzzy, suggest: true } : undefined,
      suggest: true,
      scope: criteria.scope,
    };

    const rawResults = this.engine.search(searchOptions);

    // Map to simple objects expected by the webview (suggestion dropdown)
    const mapped: SearchSuggestion[] = rawResults.map((r) => ({
      suggestion: r.title || r.fileName,
      term: r.title || r.fileName,
    }));

    return mapped;
  }

  /**
   * Search in prompt content only
   */
  async searchInContent(
    query: string,
    options: {
      caseSensitive?: boolean;
      fuzzy?: FuzzyOptions;
      matchWholeWord?: boolean;
    } = {}
  ): Promise<ContentSearchResult[]> {
    const searchCriteria: SearchCriteria = {
      query,
      scope: SearchScope.CONTENT,
      caseSensitive: options.caseSensitive || false,
      fuzzy: options.fuzzy,
      isActive: true,
      matchWholeWord: options.matchWholeWord ?? false,
    };

    return await this.search(searchCriteria);
  }

  /**
   * Search in titles only
   */
  async searchInTitles(
    query: string,
    options: {
      caseSensitive?: boolean;
      fuzzy?: FuzzyOptions;
      matchWholeWord?: boolean;
    } = {}
  ): Promise<ContentSearchResult[]> {
    const searchCriteria: SearchCriteria = {
      query,
      scope: SearchScope.TITLES,
      caseSensitive: options.caseSensitive || false,
      fuzzy: options.fuzzy,
      isActive: true,
      matchWholeWord: options.matchWholeWord ?? false,
    };

    return await this.search(searchCriteria);
  }

  /**
   * Search in both titles and content
   */
  async searchBoth(
    query: string,
    options: {
      caseSensitive?: boolean;
      fuzzy?: FuzzyOptions;
      matchWholeWord?: boolean;
    } = {}
  ): Promise<ContentSearchResult[]> {
    const searchCriteria: SearchCriteria = {
      query,
      scope: SearchScope.ALL,
      caseSensitive: options.caseSensitive || false,
      fuzzy: options.fuzzy,
      isActive: true,
      matchWholeWord: options.matchWholeWord ?? false,
    };

    return await this.search(searchCriteria);
  }

  /**
   * Check if a specific prompt file matches the search criteria
   */
  async matchesPrompt(
    prompt: PromptFile,
    criteria: SearchCriteria
  ): Promise<boolean> {
    if (!criteria.isActive || !trim(criteria.query)) {
      return false;
    }

    // Create a FileContent object for the single file
    const content = await this.fileManager
      .getFileSystemManager()
      .readFile(prompt.path);
    const fileContent: FileContent = {
      path: prompt.path,
      content,
    };

    return await this.engine.matches(fileContent, criteria);
  }

  /**
   * Clear search caches
   */
  clearCache(): void {
    this.engine.clearCache();
    // engine will mark not ready
  }

  /** Dispose event subscriptions when service is no longer needed */
  dispose(): void {
    this.disposables.forEach((d) => d.unsubscribe());
    this.disposables = [];
  }

  /**
   * Get available search scopes
   */
  getAvailableScopes(): Array<SearchCriteria["scope"]> {
    return [SearchScope.TITLES, SearchScope.CONTENT, SearchScope.ALL];
  }

  async publishResultsUpdated(
    resultCount: number,
    query: string
  ): Promise<void> {
    eventBus.emit("search.results.updated", { resultCount, query });
  }

  // Private helper methods

  private convertMatches(matches: Record<string, string[]>): SearchMatch[] {
    const searchMatches: SearchMatch[] = [];

    for (const [field, terms] of Object.entries(matches)) {
      for (const term of terms) {
        // Map FlexSearch field names to SearchMatch types
        let matchType: SearchMatch["type"];
        switch (field) {
          case "title":
          case "fileName":
            matchType = "title";
            break;
          case "description":
            matchType = "description";
            break;
          case "tags":
            matchType = "tags";
            break;
          case "content":
          default:
            matchType = "content";
            break;
        }

        searchMatches.push({
          type: matchType,
          position: 0, // FlexSearch doesn't provide exact positions
          length: term.length,
          context: term,
        });
      }
    }

    return searchMatches;
  }

  private async getFileContentsForSearch(): Promise<FileContent[]> {
    const structure = await this.fileManager.scanPrompts();
    const allFiles: PromptFile[] = [
      ...structure.rootPrompts,
      ...structure.folders.flatMap((folder) => folder.prompts),
    ];

    const fileContents: FileContent[] = [];

    for (const promptFile of allFiles) {
      try {
        const content = await this.fileManager
          .getFileSystemManager()
          .readFile(promptFile.path);
        fileContents.push({
          path: promptFile.path,
          content,
        });
      } catch (error) {
        log.warn(`Failed to read file for search: ${promptFile.path}`, error);
      }
    }

    return fileContents;
  }

  private async convertSearchResultToPromptFile(
    result: any
  ): Promise<PromptFile> {
    // Get all files from file manager
    const structure = await this.fileManager.scanPrompts();
    const allFiles: PromptFile[] = [
      ...structure.rootPrompts,
      ...structure.folders.flatMap((folder) => folder.prompts),
    ];

    // Use shared utility function
    return searchResultToPromptFile(
      result,
      allFiles,
      this.fileManager.getFileSystemManager()
    );
  }
}
