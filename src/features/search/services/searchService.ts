import { injectable, inject } from "tsyringe";
import {
  FileManager,
  ContentSearchResult,
  PromptFile,
} from "@features/prompt-manager/data/fileManager";
import { SearchCriteria } from "@features/search/types/SearchCriteria";
import {
  FileContent,
  MiniSearchEngine,
} from "@features/search/core/MiniSearchEngine";
import {
  eventBus,
  EventMap,
  ExtensionSubscription,
} from "@infra/vscode/ExtensionBus";
import { log } from "@infra/vscode/log";
import { DI_TOKENS } from "@infra/di/di-tokens";
import trim from "lodash-es/trim.js";
import { searchResultToPromptFile } from "@features/search/utils/promptFile";
import { Suggestion } from "minisearch";

@injectable()
export class SearchService {
  private fileManager: FileManager;
  private engine: MiniSearchEngine;
  private disposables: ExtensionSubscription[] = [];

  constructor(@inject(DI_TOKENS.FileManager) fileManager: FileManager) {
    this.fileManager = fileManager;
    this.engine = new MiniSearchEngine();

    // Listen to filesystem changes and clear search cache automatically
    const eventsToWatch: (keyof EventMap)[] = [
      "filesystem.file.created",
      "filesystem.file.deleted",
      "filesystem.file.changed",
      "filesystem.directory.created",
      "filesystem.directory.deleted",
      "filesystem.directory.changed",
    ];

    for (const key of eventsToWatch) {
      const sub = eventBus.on(key as any, () => {
        this.engine.clearCache();
      });
      this.disposables.push(sub);
    }
  }

  /**
   * Centralized search method using MiniSearch
   */
  async search(criteria: SearchCriteria): Promise<ContentSearchResult[]> {
    if (!criteria.isActive || !trim(criteria.query)) {
      return [];
    }

    // Get file contents for search
    const files = await this.getFileContentsForSearch();

    // Use the streamlined MiniSearchEngine
    const results = await this.engine.search(files, criteria);

    // Convert SearchResult[] to ContentSearchResult[]
    const contentResults: ContentSearchResult[] = [];
    for (const result of results) {
      const file = await this.convertSearchResultToPromptFile(result);
      contentResults.push({
        file,
        score: result.score,
        matches: result.matches,
      });
    }

    // Publish search results updated event
    await this.publishResultsUpdated(contentResults.length, criteria.query);

    return contentResults;
  }

  /**
   * Get autocomplete suggestions
   */
  async getSuggestions(criteria: SearchCriteria): Promise<Suggestion[]> {
    if (!trim(criteria.query)) {
      return [];
    }

    // Get file contents for search
    const files = await this.getFileContentsForSearch();

    // Get suggestions from MiniSearchEngine
    return await this.engine.autocomplete(files, criteria);
  }

  /**
   * Search in prompt content only
   */
  async searchInContent(
    query: string,
    options: {
      caseSensitive?: boolean;
      fuzzy?: boolean;
      matchWholeWord?: boolean;
    } = {}
  ): Promise<ContentSearchResult[]> {
    const searchCriteria: SearchCriteria = {
      query,
      scope: "content",
      caseSensitive: options.caseSensitive || false,
      fuzzy: options.fuzzy || false,
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
      fuzzy?: boolean;
      matchWholeWord?: boolean;
    } = {}
  ): Promise<ContentSearchResult[]> {
    const searchCriteria: SearchCriteria = {
      query,
      scope: "titles",
      caseSensitive: options.caseSensitive || false,
      fuzzy: options.fuzzy || false,
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
      fuzzy?: boolean;
      matchWholeWord?: boolean;
    } = {}
  ): Promise<ContentSearchResult[]> {
    const searchCriteria: SearchCriteria = {
      query,
      scope: "both",
      caseSensitive: options.caseSensitive || false,
      fuzzy: options.fuzzy || false,
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
    return ["titles", "content", "both"];
  }

  async publishResultsUpdated(
    resultCount: number,
    query: string
  ): Promise<void> {
    eventBus.emit("search.results.updated", { resultCount, query });
  }

  // Private helper methods

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
