import { injectable, inject } from "tsyringe";
import {
  FileManager,
  ContentSearchResult,
  PromptFile,
} from "@features/prompt-manager/data/fileManager";
import { SearchCriteria as PanelSearchCriteria } from "@features/search/ui/SearchPanelProvider";
import { SearchCriteria } from "@features/search/core/SearchEngine";
import { FileContent, SearchEngine } from "@features/search/core/SearchEngine";
import { eventBus } from "@infra/vscode/ExtensionBus";
import { log } from "@infra/vscode/log";
import { DI_TOKENS } from "@infra/di/di-tokens";
import trim from "lodash-es/trim.js";
import { searchResultToPromptFile } from "@features/search/utils/promptFile";

@injectable()
export class SearchService {
  private fileManager: FileManager;
  private engine: SearchEngine;

  constructor(@inject(DI_TOKENS.FileManager) fileManager: FileManager) {
    this.fileManager = fileManager;
    this.engine = new SearchEngine();
  }

  /**
   * Centralized search method using fuse.js
   */
  async search(criteria: SearchCriteria): Promise<ContentSearchResult[]> {
    if (!criteria.isActive || !trim(criteria.query)) {
      return [];
    }

    // Get file contents for search
    const files = await this.getFileContentsForSearch();

    // Use the streamlined SearchEngine
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
   * Search in prompt content only
   */
  async searchInContent(
    query: string,
    options: {
      caseSensitive?: boolean;
      exact?: boolean;
      threshold?: number;
    } = {}
  ): Promise<ContentSearchResult[]> {
    const searchCriteria: SearchCriteria = {
      query,
      scope: "content",
      caseSensitive: options.caseSensitive || false,
      exact: options.exact,
      threshold: options.threshold,
      isActive: true,
    };

    return await this.search(searchCriteria);
  }

  /**
   * Search in prompt titles only
   */
  async searchInTitle(
    query: string,
    options: {
      caseSensitive?: boolean;
      exact?: boolean;
      threshold?: number;
    } = {}
  ): Promise<ContentSearchResult[]> {
    const searchCriteria: SearchCriteria = {
      query,
      scope: "titles",
      caseSensitive: options.caseSensitive || false,
      exact: options.exact,
      threshold: options.threshold,
      isActive: true,
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
      exact?: boolean;
      threshold?: number;
    } = {}
  ): Promise<ContentSearchResult[]> {
    const searchCriteria: SearchCriteria = {
      query,
      scope: "both",
      caseSensitive: options.caseSensitive || false,
      exact: options.exact,
      threshold: options.threshold,
      isActive: true,
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
   * Count total matches for search criteria
   */
  async countMatches(criteria: SearchCriteria): Promise<number> {
    if (!criteria.isActive || !trim(criteria.query)) {
      return 0;
    }

    const files = await this.getFileContentsForSearch();
    return await this.engine.count(files, criteria);
  }

  /**
   * Clear search caches
   */
  clearCache(): void {
    this.engine.clearCache();
  }

  /**
   * Get available search scopes
   * #TODO:UI must rely on this to show the correct scopes
   */
  getAvailableScopes(): Array<SearchCriteria["scope"]> {
    return this.engine.getAvailableScopes();
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
