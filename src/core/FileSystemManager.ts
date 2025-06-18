import * as vscode from "vscode";
import * as fsExtra from "fs-extra";
import * as path from "path";
import { injectable, inject } from "tsyringe";
import { DI_TOKENS } from "./di-tokens";
import { ConfigurationService } from "../config";
import { log } from "./log";

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
}
