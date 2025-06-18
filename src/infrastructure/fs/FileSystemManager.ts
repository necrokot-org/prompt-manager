import * as vscode from "vscode";
import * as fsExtra from "fs-extra";
import * as path from "path";
import { injectable, inject } from "tsyringe";
import { DI_TOKENS } from "@infra/di/di-tokens";
import { ConfigurationService } from "@infra/config/config";
import { log } from "@infra/vscode/log";

export interface FileSystemOperation {
  path: string;
  operation: "create" | "delete" | "read" | "write";
  timestamp: number;
}

@injectable()
export class FileSystemManager {
  private readonly defaultPromptManagerDir = ".prompt_manager";

  private static readonly README_CONTENT = `# Prompt Manager

This directory contains your LLM prompts organized by the VSCode Prompt Manager extension.

## Structure

- Create folders to organize your prompts by category
- Each prompt is a markdown file with optional front matter metadata
- Front matter can include title, description, tags, and other metadata

## Example Prompt File

\`\`\`markdown
---
title: "Code Review Helper"
description: "Assists with comprehensive code review"
tags: ["review", "quality", "feedback"]
---

# Code Review Helper

Your prompt content goes here...
\`\`\`

Happy prompting!
`;

  constructor(
    @inject(DI_TOKENS.ConfigurationService)
    private configurationService: ConfigurationService
  ) {}

  /**
   * Get the prompt manager directory path
   */
  public getPromptManagerPath(): string | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders || workspaceFolders.length === 0) {
      log.debug("FileSystemManager: No workspace folders available");
      return undefined;
    }

    // Log the workspace context for debugging
    const workspaceName = vscode.workspace.name;
    const isWorkspaceFile = vscode.workspace.workspaceFile !== undefined;

    log.debug(
      `FileSystemManager: Workspace detection - Name: ${workspaceName}, IsWorkspaceFile: ${isWorkspaceFile}, Folders: ${workspaceFolders.length}`
    );

    // Use the first workspace folder (works for both single folder and workspace scenarios)
    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    log.debug(`FileSystemManager: Using workspace root: ${workspaceRoot}`);

    // Use configuration service for directory name
    const dirName = this.configurationService.getDefaultPromptDirectory();

    const promptPath = path.join(workspaceRoot, dirName);
    log.debug(`FileSystemManager: Prompt manager path: ${promptPath}`);

    return promptPath;
  }

  /**
   * Ensure the prompt manager directory exists
   */
  public async ensurePromptManagerDirectory(): Promise<boolean> {
    const promptPath = this.getPromptManagerPath();
    if (!promptPath) {
      return false;
    }

    try {
      // Use fs-extra's ensureDir instead of mkdir with recursive
      await fsExtra.ensureDir(promptPath);

      // Create README file directly with fs-extra's outputFile
      const readmePath = path.join(promptPath, "README.md");

      // Only create README if it doesn't exist
      if (!(await fsExtra.pathExists(readmePath))) {
        await fsExtra.outputFile(readmePath, FileSystemManager.README_CONTENT);
      }

      return true;
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to create .prompt_manager directory: ${error}`
      );
      return false;
    }
  }

  /**
   * Read file content
   */
  public async readFile(filePath: string): Promise<string> {
    try {
      return await fsExtra.readFile(filePath, "utf8");
    } catch (error) {
      log.error(`Failed to read file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Write file content
   */
  public async writeFile(filePath: string, content: string): Promise<void> {
    try {
      await fsExtra.outputFile(filePath, content);
    } catch (error) {
      log.error(`Failed to write file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Delete file
   */
  public async deleteFile(filePath: string): Promise<void> {
    try {
      await fsExtra.remove(filePath);
    } catch (error) {
      log.error(`Failed to delete file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Create directory
   */
  public async createDirectory(dirPath: string): Promise<void> {
    try {
      await fsExtra.ensureDir(dirPath);
    } catch (error) {
      log.error(`Failed to create directory ${dirPath}:`, error);
      throw error;
    }
  }

  /**
   * Get file stats
   */
  public async getFileStats(filePath: string): Promise<fsExtra.Stats> {
    try {
      return await fsExtra.stat(filePath);
    } catch (error) {
      log.error(`Failed to get stats for ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Check if file exists
   */
  public fileExists(filePath: string): boolean {
    return fsExtra.existsSync(filePath);
  }

  /**
   * Read directory contents
   */
  public async readDirectory(dirPath: string): Promise<fsExtra.Dirent[]> {
    try {
      return await fsExtra.readdir(dirPath, { withFileTypes: true });
    } catch (error) {
      log.error(`Failed to read directory ${dirPath}:`, error);
      throw error;
    }
  }

  /**
   * Batch read multiple files
   */
  public async batchReadFiles(
    filePaths: string[]
  ): Promise<Map<string, string>> {
    const results = new Map<string, string>();

    try {
      const promises = filePaths.map(async (filePath) => {
        try {
          const content = await this.readFile(filePath);
          return { filePath, content };
        } catch (error) {
          log.warn(`Failed to read ${filePath}:`, error);
          return { filePath, content: "" };
        }
      });

      const results_array = await Promise.all(promises);
      results_array.forEach(({ filePath, content }) => {
        results.set(filePath, content);
      });
    } catch (error) {
      log.error("Batch read failed:", error);
    }

    return results;
  }

  /**
   * Move file to a new location
   */
  public async moveFile(sourcePath: string, targetPath: string): Promise<void> {
    try {
      // Ensure target directory exists
      const targetDir = path.dirname(targetPath);
      await fsExtra.ensureDir(targetDir);

      // Move the file
      await fsExtra.move(sourcePath, targetPath, { overwrite: false });

      log.debug(`File moved from ${sourcePath} to ${targetPath}`);
    } catch (error) {
      log.error(
        `Failed to move file from ${sourcePath} to ${targetPath}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Move folder to a new location
   */
  public async moveFolder(
    sourcePath: string,
    targetPath: string
  ): Promise<void> {
    try {
      // Check if source is actually a directory
      const sourceStats = await fsExtra.stat(sourcePath);
      if (!sourceStats.isDirectory()) {
        throw new Error(`Source path ${sourcePath} is not a directory`);
      }

      // Ensure parent directory of target exists
      const targetParentDir = path.dirname(targetPath);
      await fsExtra.ensureDir(targetParentDir);

      // Move the folder
      await fsExtra.move(sourcePath, targetPath, { overwrite: false });

      log.debug(`Folder moved from ${sourcePath} to ${targetPath}`);
    } catch (error) {
      log.error(
        `Failed to move folder from ${sourcePath} to ${targetPath}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Check if a file move operation would cause a conflict
   */
  public async checkMoveConflict(
    sourcePath: string,
    targetPath: string
  ): Promise<{ hasConflict: boolean; conflictType?: string }> {
    try {
      // Check if source exists
      if (!(await fsExtra.pathExists(sourcePath))) {
        return { hasConflict: true, conflictType: "source_not_found" };
      }

      // Check if target already exists
      if (await fsExtra.pathExists(targetPath)) {
        return { hasConflict: true, conflictType: "target_exists" };
      }

      // Check if source and target are the same
      if (path.resolve(sourcePath) === path.resolve(targetPath)) {
        return { hasConflict: true, conflictType: "same_location" };
      }

      return { hasConflict: false };
    } catch (error) {
      log.error(`Failed to check move conflict:`, error);
      throw error;
    }
  }

  /**
   * Get relative path from the prompt manager root
   */
  public getRelativePathFromRoot(absolutePath: string): string | undefined {
    const promptPath = this.getPromptManagerPath();
    if (!promptPath) {
      return undefined;
    }

    try {
      return path.relative(promptPath, absolutePath);
    } catch (error) {
      log.error(`Failed to get relative path:`, error);
      return undefined;
    }
  }

  /**
   * Get absolute path from relative path within prompt manager
   */
  public getAbsolutePathFromRelative(relativePath: string): string | undefined {
    const promptPath = this.getPromptManagerPath();
    if (!promptPath) {
      return undefined;
    }

    return path.join(promptPath, relativePath);
  }
}
