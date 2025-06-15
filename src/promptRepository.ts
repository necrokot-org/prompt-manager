import * as vscode from "vscode";
import { FileManager, PromptStructure, PromptFile } from "./fileManager";

export interface PromptRepositoryEvents {
  onStructureChanged: vscode.Event<void>;
}

/**
 * PromptRepository handles all file system operations, caching, and watching
 * for the prompt manager. It's designed to be testable without VSCode stubs.
 */
export class PromptRepository implements PromptRepositoryEvents {
  private fileManager: FileManager;
  private fileWatcher?: vscode.FileSystemWatcher;

  // Events
  private _onStructureChanged: vscode.EventEmitter<void> =
    new vscode.EventEmitter<void>();
  public readonly onStructureChanged: vscode.Event<void> =
    this._onStructureChanged.event;

  constructor(fileManager?: FileManager) {
    this.fileManager = fileManager || new FileManager();
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

    this.fileWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(promptPath, "**/*.md")
    );

    this.fileWatcher.onDidCreate(() => {
      console.log("PromptRepository: File created, invalidating index");
      this.invalidateCache();
    });

    this.fileWatcher.onDidDelete(() => {
      console.log("PromptRepository: File deleted, invalidating index");
      this.invalidateCache();
    });

    this.fileWatcher.onDidChange((uri) => {
      console.log("PromptRepository: File changed, invalidating index");
      this.handleFileChange(uri);
    });
  }

  /**
   * Handle file changes - can be extended for future functionality
   */
  private async handleFileChange(uri: vscode.Uri): Promise<void> {
    // File change handling without timestamp updates
    this.invalidateCache();
  }

  /**
   * Invalidate cache and notify listeners of structure changes
   */
  private invalidateCache(): void {
    this.fileManager.invalidateIndex();
    this._onStructureChanged.fire();
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
      this.invalidateCache();
    }
    return filePath;
  }

  /**
   * Create a new folder
   */
  public async createFolder(folderName: string): Promise<string | null> {
    const folderPath = await this.fileManager.createFolder(folderName);
    if (folderPath) {
      this.invalidateCache();
    }
    return folderPath;
  }

  /**
   * Delete a prompt file
   */
  public async deletePromptFile(filePath: string): Promise<boolean> {
    const success = await this.fileManager.deletePromptFile(filePath);
    if (success) {
      this.invalidateCache();
    }
    return success;
  }

  /**
   * Read file content - used for clipboard operations
   */
  public async readFileContent(filePath: string): Promise<string | null> {
    try {
      const fs = await import("fs");
      return await fs.promises.readFile(filePath, "utf8");
    } catch (error) {
      console.error(`Failed to read file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Validate prompt content
   */
  public validatePromptContent(content: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!content || content.trim().length === 0) {
      errors.push("Prompt content cannot be empty");
    }

    if (content.length > 500000) {
      errors.push("Prompt content is too large (max 500KB)");
    }

    // Validate front matter if present
    const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontMatterMatch) {
      const frontMatter = frontMatterMatch[1];
      if (!frontMatter.includes("title:")) {
        errors.push("Front matter must include a title field");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
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
    return await this.fileManager.searchInContent(query, options);
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
    return await this.fileManager.searchInTitle(query, options);
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
    this._onStructureChanged.dispose();
  }
}
