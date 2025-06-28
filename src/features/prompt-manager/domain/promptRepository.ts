import * as vscode from "vscode";
import { injectable, inject } from "tsyringe";
import {
  FileManager,
  PromptStructure,
} from "@features/prompt-manager/data/fileManager";
import { SearchService } from "@features/search/services/searchService";
import { validatePrompt, getErrorMessages } from "@root/validation/index";
import { parsePromptContentSync } from "@root/validation/schemas/prompt";
import { DI_TOKENS } from "@infra/di/di-tokens";
import * as fs from "fs";
import { log } from "@infra/vscode/log";

/**
 * PromptRepository handles all file system operations, caching, and watching
 * for the prompt manager. It's designed to be testable without VSCode stubs.
 * Now integrated with the centralized event system and dependency injection.
 */
@injectable()
export class PromptRepository {
  private fileManager: FileManager;
  private searchService: SearchService;
  private fileWatcher?: vscode.FileSystemWatcher;

  constructor(
    @inject(DI_TOKENS.FileManager) fileManager: FileManager,
    @inject(DI_TOKENS.SearchService) searchService: SearchService
  ) {
    this.fileManager = fileManager;
    this.searchService = searchService;
  }

  /**
   * Initialize the repository, ensure directories exist and setup file watching
   */
  public async initialize(): Promise<boolean> {
    const success = await this.fileManager.ensurePromptManagerDirectory();
    if (success) {
      this.setupFileWatcher();
    }
    return success;
  }

  /**
   * Setup file system watching for prompt files
   */
  private setupFileWatcher(): void {
    const promptPath = this.fileManager.getPromptManagerPath();
    if (!promptPath) {
      return;
    }

    // Watch for both file and directory changes
    this.fileWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(promptPath, "**/*")
    );

    // Setup file watcher events with unified handling
    [
      { event: "onDidCreate" as const, handler: this.handleFileCreated },
      { event: "onDidDelete" as const, handler: this.handleFileDeleted },
      { event: "onDidChange" as const, handler: this.handleFileChange },
    ].forEach(({ event, handler }) => {
      this.fileWatcher![event](handler.bind(this));
    });
  }

  /**
   * Handle file creation events
   */
  private handleFileCreated(uri: vscode.Uri): void {
    log.debug("PromptRepository: File created, invalidating index");
    this.invalidateCache().catch((error) => {
      log.error(
        "PromptRepository: Failed to invalidate cache on file creation",
        error
      );
    });
  }

  /**
   * Handle file deletion events
   */
  private handleFileDeleted(uri: vscode.Uri): void {
    log.debug("PromptRepository: File deleted, invalidating index");
    this.invalidateCache().catch((error) => {
      log.error(
        "PromptRepository: Failed to invalidate cache on file deletion",
        error
      );
    });
  }

  /**
   * Handle file changes - can be extended for future functionality
   */
  private async handleFileChange(uri: vscode.Uri): Promise<void> {
    // File change handling without timestamp updates
    await this.invalidateCache();
  }

  /**
   * Invalidate cache and notify listeners of structure changes
   */
  private async invalidateCache(): Promise<void> {
    await this.fileManager.rebuildIndex();
  }

  /**
   * Get the current prompt structure
   */
  public async getPromptStructure(): Promise<PromptStructure> {
    return await this.fileManager.scanPrompts();
  }

  /**
   * Create a new prompt file
   */
  public async createPromptFile(
    fileName: string,
    targetFolderPath?: string
  ): Promise<string | null> {
    const filePath = await this.fileManager.createPromptFile(
      fileName,
      targetFolderPath
    );
    if (filePath) {
      await this.invalidateCache();
    }
    return filePath;
  }

  /**
   * Create a new folder
   */
  public async createFolder(folderName: string): Promise<string | null> {
    const folderPath = await this.fileManager.createFolder(folderName);
    if (folderPath) {
      await this.invalidateCache();
    }
    return folderPath;
  }

  /**
   * Delete a prompt file
   */
  public async deletePromptFile(filePath: string): Promise<boolean> {
    const success = await this.fileManager.deletePromptFile(filePath);
    if (success) {
      await this.invalidateCache();
    }
    return success;
  }

  /**
   * Delete a folder and all its contents
   */
  public async deleteFolderWithContents(folderPath: string): Promise<boolean> {
    const success = await this.fileManager.deleteFolder(folderPath);
    if (success) {
      await this.invalidateCache();
    }
    return success;
  }

  /**
   * Read file content - used for clipboard operations
   */
  public async readFileContent(filePath: string): Promise<string | null> {
    try {
      return await fs.promises.readFile(filePath, "utf8");
    } catch (error) {
      log.error(`Failed to read file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Validate prompt content using the new validation layer
   */
  public async validatePromptContent(content: string): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    // Parse the content to extract structured data using unified parsing
    const parsed = parsePromptContentSync(content);

    // Create PromptContent structure for validation
    const promptContent = {
      content: parsed.content,
      frontMatter: parsed.frontMatter,
      title: parsed.title,
      description: parsed.description,
      tags: parsed.tags,
    };

    // Validate using the new Zod-based validator
    const result = validatePrompt(promptContent, {
      requireTitle: false,
      requireDescription: false,
      maxContentLength: 500000,
      strictMode: false,
    });

    return {
      isValid: result.success,
      errors: getErrorMessages(result),
      warnings: [], // Zod doesn't distinguish warnings, all are errors
    };
  }

  /**
   * Search in prompt content
   */
  public async searchInContent(
    query: string,
    options: {
      caseSensitive?: boolean;
      exact?: boolean;
      includeYaml?: boolean;
    } = {}
  ) {
    return await this.searchService.searchInContent(query, options);
  }

  /**
   * Search in prompt titles
   */
  public async searchInTitle(
    query: string,
    options: {
      caseSensitive?: boolean;
      exact?: boolean;
    } = {}
  ) {
    return await this.searchService.searchInTitle(query, options);
  }

  /**
   * Get the underlying FileManager (for advanced operations)
   */
  public getFileManager(): FileManager {
    return this.fileManager;
  }

  /**
   * Dispose of resources (file watchers, etc.)
   */
  public dispose(): void {
    if (this.fileWatcher) {
      this.fileWatcher.dispose();
    }
  }
}
