import * as path from "path";
import { injectable, inject } from "tsyringe";

import { FileSystemEventPublisher as fsEvents } from "@infra/vscode/FileSystemEventPublisher";
import { log } from "@infra/vscode/log";
import { DI_TOKENS } from "@infra/di/di-tokens";

// Import all the focused components
import { FileSystemManager } from "@infra/fs/FileSystemManager";
import {
  serializePromptContent,
  PromptContent,
} from "@root/validation/schemas/prompt";

import {
  DirectoryScanner,
  PromptFile,
  PromptFolder,
  PromptStructure,
} from "core/DirectoryScanner";
import { sanitizeFileName } from "@root/validation/index";

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
  private directoryScanner: DirectoryScanner;

  constructor(
    @inject(DI_TOKENS.FileSystemManager)
    fileSystemManager: FileSystemManager
  ) {
    // Initialize all components
    this.fileSystemManager = fileSystemManager;
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

  public async rebuildIndex(): Promise<void> {
    await this.directoryScanner.rebuildIndex();
  }

  public async rebuildIndexForce(): Promise<void> {
    await this.directoryScanner.rebuildIndexForce();
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
      log.warn(`Prompt file "${fullFileName}" already exists.`);
      return null;
    }

    // Build prompt content using unified schema utilities
    const promptContent: PromptContent = {
      content: `# ${fileName}\n\nWrite your prompt here...`,
      title: fileName,
      description: "",
      tags: [],
    };
    const frontMatterContent = serializePromptContent(promptContent);

    try {
      await this.fileSystemManager.writeFile(filePath, frontMatterContent);

      // Publish file created event
      this.publishFileEvent("created", filePath);

      return filePath;
    } catch (error) {
      log.error(`Failed to create prompt file: ${error}`);
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
      log.warn(`Folder "${sanitizedName}" already exists.`);
      return null;
    }

    try {
      await this.fileSystemManager.createDirectory(folderPath);

      // Publish directory created event
      this.publishDirectoryCreated(folderPath);

      return folderPath;
    } catch (error) {
      log.error(`Failed to create folder: ${error}`);
      return null;
    }
  }

  public async deletePromptFile(filePath: string): Promise<boolean> {
    try {
      await this.fileSystemManager.deleteFile(filePath);

      // Publish file deleted event
      fsEvents.resourceDeleted(filePath);

      return true;
    } catch (error) {
      log.error(`Failed to delete prompt file: ${error}`);
      return false;
    }
  }

  /**
   * Delete a folder and all its contents
   */
  public async deleteFolder(folderPath: string): Promise<boolean> {
    try {
      await this.fileSystemManager.deleteFile(folderPath);
      log.debug(`Folder deleted: ${folderPath}`);

      // Publish folder deleted event
      fsEvents.resourceDeleted(folderPath);

      return true;
    } catch (error) {
      log.error(`Failed to delete folder: ${error}`);
      return false;
    }
  }

  // Component access methods (for advanced usage)

  public getFileSystemManager(): FileSystemManager {
    return this.fileSystemManager;
  }

  private publishFileEvent(
    eventType: "created" | "deleted" | "changed",
    filePath: string
  ): void {
    const fileName = filePath.split(/[\\/]/).pop() || filePath;
    switch (eventType) {
      case "created":
        fsEvents.fileCreated(filePath);
        break;
      case "deleted":
        fsEvents.resourceDeleted(filePath);
        break;
      case "changed":
        fsEvents.fileChanged(filePath);
        break;
    }
  }

  private publishDirectoryCreated(dirPath: string): void {
    fsEvents.dirCreated(dirPath);
  }
}
