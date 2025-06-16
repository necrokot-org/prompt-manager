import { FileManager, ContentSearchResult, PromptFile } from "./fileManager";
import { SearchCriteria } from "./searchPanelProvider";
import { FileContent } from "./core/SearchEngine";
import { searchEngine } from "./searchEngine";
import { publish } from "./core/eventBus";
import { EventBuilder } from "./core/EventSystem";
import { trim } from "lodash";

export class SearchService {
  private fileManager: FileManager;

  constructor(fileManager: FileManager) {
    this.fileManager = fileManager;
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
    const results = await searchEngine.search(files, criteria);

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

    return await searchEngine.matches(fileContent, criteria);
  }

  /**
   * Count total matches for search criteria
   */
  async countMatches(criteria: SearchCriteria): Promise<number> {
    if (!criteria.isActive || !trim(criteria.query)) {
      return 0;
    }

    const files = await this.getFileContentsForSearch();
    return await searchEngine.count(files, criteria);
  }

  /**
   * Clear search caches
   */
  clearCache(): void {
    searchEngine.clearCache();
  }

  /**
   * Get available search scopes
   * #TODO:UI must rely on this to show the correct scopes
   */
  getAvailableScopes(): Array<SearchCriteria["scope"]> {
    return searchEngine.getAvailableScopes();
  }

  async publishResultsUpdated(
    resultCount: number,
    query: string
  ): Promise<void> {
    publish(
      EventBuilder.search.resultsUpdated(resultCount, query, "SearchService")
    );
  }

  async publishCleared(): Promise<void> {
    publish(EventBuilder.search.cleared("SearchService"));
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
        console.warn(
          `Failed to read file for search: ${promptFile.path}`,
          error
        );
      }
    }

    return fileContents;
  }

  private async convertSearchResultToPromptFile(
    result: any
  ): Promise<PromptFile> {
    // Try to find the file in our directory scanner
    const structure = await this.fileManager.scanPrompts();
    const allFiles: PromptFile[] = [
      ...structure.rootPrompts,
      ...structure.folders.flatMap((folder) => folder.prompts),
    ];

    const file = allFiles.find((f) => f.path === result.filePath);

    if (file) {
      return file;
    }

    // Create a PromptFile from the search result
    try {
      const stats = await this.fileManager
        .getFileSystemManager()
        .getFileStats(result.filePath);
      return {
        name: result.fileName,
        title: result.title,
        path: result.filePath,
        description: undefined,
        tags: [],
        fileSize: stats.size,
        isDirectory: false,
      };
    } catch (error) {
      console.error(`Failed to get file stats for ${result.filePath}:`, error);
      // Return minimal file info
      return {
        name: result.fileName,
        title: result.title,
        path: result.filePath,
        description: undefined,
        tags: [],
        fileSize: 0,
        isDirectory: false,
      };
    }
  }
}
