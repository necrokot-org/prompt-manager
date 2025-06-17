import * as path from "path";
import { injectable, inject } from "tsyringe";

import { eventBus } from "./core/ExtensionBus";
import { DI_TOKENS } from "./core/di-tokens";

// Import all the focused components
import { FileSystemManager } from "./core/FileSystemManager";
import { PromptParser, PromptMetadata } from "./core/PromptParser";
import { LRUCache } from "lru-cache";
import {
  DirectoryScanner,
  PromptFile,
  PromptFolder,
  PromptStructure,
} from "./core/DirectoryScanner";
import { sanitizeFileName } from "./validation/index";

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
 * Now integrated with the centralized event system and dependency injection.
 */
@injectable()
export class FileManager {
  // Core components
  private fileSystemManager: FileSystemManager;
  private promptParser: PromptParser;
  private contentCache: LRUCache<string, string>;
  private directoryScanner: DirectoryScanner;

  constructor(
    @inject(DI_TOKENS.FileSystemManager)
    fileSystemManager: FileSystemManager
  ) {
    // Initialize all components
    this.fileSystemManager = fileSystemManager;
    this.promptParser = new PromptParser();
    this.contentCache = new LRUCache<string, string>({
      max: 1000,
      ttl: 5 * 60 * 1000, // 5 minutes
    });
    this.directoryScanner = new DirectoryScanner(this.fileSystemManager);
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
    const sanitizedName = sanitizeFileName(fileName);
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
      this.publishFileEvent("created", filePath);

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

    const sanitizedName = sanitizeFileName(folderName);
    const folderPath = path.join(promptPath, sanitizedName);

    if (this.fileSystemManager.fileExists(folderPath)) {
      console.warn(`Folder "${sanitizedName}" already exists.`);
      return null;
    }

    try {
      await this.fileSystemManager.createDirectory(folderPath);

      // Publish directory created event
      this.publishDirectoryCreated(folderPath);

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
      this.publishFileEvent("deleted", filePath);

      // Invalidate cache and rebuild index since we deleted a file
      this.invalidateIndex();
      await this.buildIndex();

      return true;
    } catch (error) {
      console.error(`Failed to delete prompt file: ${error}`);
      return false;
    }
  }

  // Cache management

  public clearContentCache(): void {
    this.contentCache.clear();
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

  private publishFileEvent(
    eventType: "created" | "deleted" | "changed",
    filePath: string
  ): void {
    const fileName = filePath.split(/[\\/]/).pop() || filePath;
    switch (eventType) {
      case "created":
        eventBus.emit("filesystem.file.created", { filePath, fileName });
        break;
      case "deleted":
        eventBus.emit("filesystem.file.deleted", { filePath, fileName });
        break;
      case "changed":
        eventBus.emit("filesystem.file.changed", { filePath, fileName });
        break;
    }
  }

  private publishDirectoryCreated(dirPath: string): void {
    eventBus.emit("filesystem.directory.created", {
      dirPath,
      dirName: dirPath.split(/[\\/]/).pop() || dirPath,
    });
  }
}
