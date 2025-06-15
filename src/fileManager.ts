import * as path from "path";
import { normalizeFileName, FileNamingPattern } from "./utils/string";
import { getFileNamingPattern } from "./config";
import { ExtensionEventBus, EventBuilder } from "./core/EventSystem";

// Import all the focused components
import { FileSystemManager } from "./core/FileSystemManager";
import {
  PromptParser,
  ParsedPromptContent,
  PromptMetadata,
} from "./core/PromptParser";
import { CacheManager } from "./core/CacheManager";
import {
  DirectoryScanner,
  PromptFile,
  PromptFolder,
  PromptStructure,
} from "./core/DirectoryScanner";
import {
  SearchEngine,
  SearchCriteria,
  SearchResult,
  FileContent,
} from "./core/SearchEngine";

// Legacy interfaces for backward compatibility
export interface SearchablePromptFile extends PromptFile {
  content?: string;
  frontMatter?: any;
  bodyContent?: string;
}

export interface ContentSearchResult {
  file: PromptFile;
  score: number;
  matches: SearchMatch[];
}

export interface SearchMatch {
  type: "title" | "content" | "description" | "tags";
  position: number;
  length: number;
  context: string;
}

// Re-export interfaces for backward compatibility
export { PromptFile, PromptFolder, PromptStructure };

/**
 * Refactored FileManager that acts as a facade for focused component classes
 * This maintains the same interface as the original FileManager while delegating
 * responsibilities to specialized components.
 * Now integrated with the centralized event system.
 */
export class FileManager {
  // Core components
  private fileSystemManager: FileSystemManager;
  private promptParser: PromptParser;
  private contentCache: CacheManager<string>;
  private directoryScanner: DirectoryScanner;
  private searchEngine: SearchEngine;
  private eventBus: ExtensionEventBus;

  constructor(eventBus: ExtensionEventBus) {
    this.eventBus = eventBus;

    // Initialize all components
    this.fileSystemManager = new FileSystemManager();
    this.promptParser = new PromptParser();
    this.contentCache = new CacheManager<string>({
      ttl: 5 * 60 * 1000, // 5 minutes
      maxSize: 1000,
    });
    this.directoryScanner = new DirectoryScanner(this.fileSystemManager);
    this.searchEngine = new SearchEngine();
  }

  // File system operations (delegate to FileSystemManager)

  public getPromptManagerPath(): string | undefined {
    return this.fileSystemManager.getPromptManagerPath();
  }

  public async ensurePromptManagerDirectory(): Promise<boolean> {
    const result = await this.fileSystemManager.ensurePromptManagerDirectory();
    if (result) {
      // Build initial index after ensuring directory exists
      await this.directoryScanner.buildIndex();
    }
    return result;
  }

  // Directory scanning operations (delegate to DirectoryScanner)

  public async buildIndex(): Promise<void> {
    await this.directoryScanner.buildIndex();
  }

  public invalidateIndex(): void {
    this.directoryScanner.invalidateIndex();
    this.clearSearchCache();
  }

  public async scanPrompts(): Promise<PromptStructure> {
    return await this.directoryScanner.scanPrompts();
  }

  // File operations

  public async createPromptFile(
    fileName: string,
    folderPath?: string
  ): Promise<string | null> {
    const promptPath = this.fileSystemManager.getPromptManagerPath();
    if (!promptPath) {
      return null;
    }

    await this.ensurePromptManagerDirectory();

    // Sanitize filename
    const sanitizedName = this.getSanitizedName(fileName);
    const fullFileName = `${sanitizedName}.md`;

    const targetDir = folderPath || promptPath;
    const filePath = path.join(targetDir, fullFileName);

    // Check if file already exists
    if (this.fileSystemManager.fileExists(filePath)) {
      console.warn(`Prompt file "${fullFileName}" already exists.`);
      return null;
    }

    // Create front matter content using PromptParser
    const metadata: PromptMetadata = {
      title: fileName,
      description: "",
      tags: [],
    };
    const bodyContent = `# ${fileName}\n\nWrite your prompt here...`;
    const frontMatterContent = this.promptParser.createPromptFile(
      metadata,
      bodyContent
    );

    try {
      await this.fileSystemManager.writeFile(filePath, frontMatterContent);

      // Publish file created event
      this.eventBus.publishSync(
        EventBuilder.fileSystem.fileCreated(filePath, "FileManager")
      );

      // Invalidate cache and rebuild index since we added a new file
      this.invalidateIndex();
      await this.buildIndex();

      return filePath;
    } catch (error) {
      console.error(`Failed to create prompt file: ${error}`);
      return null;
    }
  }

  public async createFolder(folderName: string): Promise<string | null> {
    const promptPath = this.fileSystemManager.getPromptManagerPath();
    if (!promptPath) {
      return null;
    }

    await this.ensurePromptManagerDirectory();

    const sanitizedName = this.getSanitizedName(folderName);
    const folderPath = path.join(promptPath, sanitizedName);

    if (this.fileSystemManager.fileExists(folderPath)) {
      console.warn(`Folder "${sanitizedName}" already exists.`);
      return null;
    }

    try {
      await this.fileSystemManager.createDirectory(folderPath);

      // Publish directory created event
      this.eventBus.publishSync(
        EventBuilder.fileSystem.directoryCreated(folderPath, "FileManager")
      );

      // Invalidate cache and rebuild index since we added a new folder
      this.invalidateIndex();
      await this.buildIndex();

      return folderPath;
    } catch (error) {
      console.error(`Failed to create folder: ${error}`);
      return null;
    }
  }

  public async deletePromptFile(filePath: string): Promise<boolean> {
    try {
      await this.fileSystemManager.deleteFile(filePath);

      // Publish file deleted event
      this.eventBus.publishSync(
        EventBuilder.fileSystem.fileDeleted(filePath, "FileManager")
      );

      // Invalidate cache and rebuild index since we deleted a file
      this.invalidateIndex();
      await this.buildIndex();

      return true;
    } catch (error) {
      console.error(`Failed to delete prompt file: ${error}`);
      return false;
    }
  }

  // Search operations (delegate to SearchEngine)

  public async searchInContent(
    query: string,
    options: {
      caseSensitive?: boolean;
      exact?: boolean;
      includeYaml?: boolean;
    } = {}
  ): Promise<ContentSearchResult[]> {
    const files = await this.getFileContentsForSearch();

    const searchCriteria: SearchCriteria = {
      query,
      scope: "content",
      caseSensitive: options.caseSensitive || false,
      exact: options.exact || false,
      includeYaml: options.includeYaml || false,
      isActive: true,
    };

    const results = await this.searchEngine.searchFiles(files, searchCriteria);

    // Convert SearchResult[] to ContentSearchResult[] for backward compatibility
    const contentResults: ContentSearchResult[] = [];
    for (const result of results) {
      const file = await this.searchResultToPromptFile(result);
      contentResults.push({
        file,
        score: result.score,
        matches: result.matches,
      });
    }
    return contentResults;
  }

  public async searchInTitle(
    query: string,
    options: {
      caseSensitive?: boolean;
      exact?: boolean;
    } = {}
  ): Promise<ContentSearchResult[]> {
    const files = await this.getFileContentsForSearch();

    const searchCriteria: SearchCriteria = {
      query,
      scope: "titles",
      caseSensitive: options.caseSensitive || false,
      exact: options.exact || false,
      isActive: true,
    };

    const results = await this.searchEngine.searchFiles(files, searchCriteria);

    // Convert SearchResult[] to ContentSearchResult[] for backward compatibility
    const contentResults: ContentSearchResult[] = [];
    for (const result of results) {
      const file = await this.searchResultToPromptFile(result);
      contentResults.push({
        file,
        score: result.score,
        matches: result.matches,
      });
    }
    return contentResults;
  }

  // Cache management

  public clearSearchCache(): void {
    this.searchEngine.clearCache();
    this.contentCache.clear();
  }

  // Private helper methods

  private getSanitizedName(name: string): string {
    const namingPattern = getFileNamingPattern();
    return normalizeFileName(name, namingPattern);
  }

  private async getFileContentsForSearch(): Promise<FileContent[]> {
    const allFiles = await this.directoryScanner.getAllPromptFiles();
    const fileContents: FileContent[] = [];

    for (const promptFile of allFiles) {
      try {
        let content = this.contentCache.get(promptFile.path);

        if (!content) {
          content = await this.fileSystemManager.readFile(promptFile.path);
          this.contentCache.set(promptFile.path, content);
        }

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

  private async searchResultToPromptFile(
    result: SearchResult
  ): Promise<PromptFile> {
    // Try to find the file in our directory scanner
    const allFiles = await this.directoryScanner.getAllPromptFiles();
    const file = allFiles.find((f) => f.path === result.filePath);

    if (file) {
      return file;
    }

    // Fallback: create a PromptFile from the search result
    try {
      const stats = await this.fileSystemManager.getFileStats(result.filePath);
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

  // Component access methods (for advanced usage)

  public getFileSystemManager(): FileSystemManager {
    return this.fileSystemManager;
  }

  public getPromptParser(): PromptParser {
    return this.promptParser;
  }

  public getDirectoryScanner(): DirectoryScanner {
    return this.directoryScanner;
  }

  public getSearchEngine(): SearchEngine {
    return this.searchEngine;
  }

  public getCacheStats() {
    return {
      contentCache: this.contentCache.getStats(),
      searchCache: this.searchEngine.getCacheStats(),
    };
  }
}
