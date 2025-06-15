import { FileManager, ContentSearchResult, PromptFile } from "./fileManager";
import { SearchCriteria } from "./searchPanelProvider";
import { SearchEngine, FileContent } from "./core/SearchEngine";

export class SearchService {
  private searchEngine: SearchEngine;

  constructor(private fileManager: FileManager) {
    this.searchEngine = new SearchEngine();
  }

  /**
   * Centralized search method that handles scope routing
   */
  async search(criteria: SearchCriteria): Promise<ContentSearchResult[]> {
    if (!criteria.isActive || !criteria.query.trim()) {
      return [];
    }

    // Get file contents for search
    const files = await this.getFileContentsForSearch();

    // Convert to our SearchEngine's criteria format
    const searchCriteria = {
      ...criteria,
      exact: false, // Can be made configurable later
      includeYaml: false, // Can be made configurable later
    };

    try {
      const results = await this.searchEngine.searchFiles(
        files,
        searchCriteria
      );

      // Convert SearchResult[] to ContentSearchResult[] for backward compatibility
      const contentResults: ContentSearchResult[] = [];
      for (const result of results) {
        const file = await this.convertSearchResultToPromptFile(result);
        contentResults.push({
          file,
          score: result.score,
          matches: result.matches,
        });
      }

      return contentResults.sort((a, b) => b.score - a.score);
    } catch (error) {
      console.error("Search failed:", error);
      // Fallback to simple text matching
      return this.fallbackSearch(criteria);
    }
  }

  /**
   * Check if a specific prompt file matches the search criteria
   */
  async matchesPrompt(
    prompt: PromptFile,
    criteria: SearchCriteria
  ): Promise<boolean> {
    try {
      // Create a FileContent object for the single file
      const content = await this.fileManager
        .getFileSystemManager()
        .readFile(prompt.path);
      const fileContent: FileContent = {
        path: prompt.path,
        content,
      };

      return await this.searchEngine.fileMatches(fileContent, criteria);
    } catch (error) {
      console.error("Error checking file match:", error);
      // Fallback to simple text matching
      return this.matchesTextFallback(prompt, criteria);
    }
  }

  /**
   * Count total matches for search criteria
   */
  async countMatches(criteria: SearchCriteria): Promise<number> {
    const results = await this.search(criteria);
    return results.length;
  }

  /**
   * Fallback text matching for when enhanced search fails
   */
  matchesTextFallback(prompt: PromptFile, criteria: SearchCriteria): boolean {
    const query = criteria.caseSensitive
      ? criteria.query
      : criteria.query.toLowerCase();

    switch (criteria.scope) {
      case "titles":
        return this.matchesText(prompt.title, query, criteria.caseSensitive);
      case "content":
        // Search in description and tags as fallback
        const searchableContent = [
          prompt.description || "",
          ...(prompt.tags || []),
        ].join(" ");
        return this.matchesText(
          searchableContent,
          query,
          criteria.caseSensitive
        );
      case "both":
        return (
          this.matchesText(prompt.title, query, criteria.caseSensitive) ||
          this.matchesText(
            [prompt.description || "", ...(prompt.tags || [])].join(" "),
            query,
            criteria.caseSensitive
          )
        );
      default:
        return false;
    }
  }

  /**
   * Clear search caches
   */
  clearCache(): void {
    this.searchEngine.clearCache();
  }

  /**
   * Get search engine statistics
   */
  getStats() {
    return this.searchEngine.getCacheStats();
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

    // Fallback: create a PromptFile from the search result
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

  private async fallbackSearch(
    criteria: SearchCriteria
  ): Promise<ContentSearchResult[]> {
    const structure = await this.fileManager.scanPrompts();
    const allFiles: PromptFile[] = [
      ...structure.rootPrompts,
      ...structure.folders.flatMap((folder) => folder.prompts),
    ];

    const results: ContentSearchResult[] = [];

    for (const file of allFiles) {
      if (this.matchesTextFallback(file, criteria)) {
        results.push({
          file,
          score: 50, // Default score for fallback matches
          matches: [
            {
              type: "title",
              position: 0,
              length: criteria.query.length,
              context: file.title,
            },
          ],
        });
      }
    }

    return results;
  }

  private matchesText(
    text: string,
    query: string,
    caseSensitive: boolean
  ): boolean {
    const searchText = caseSensitive ? text : text.toLowerCase();
    return searchText.includes(query);
  }
}
