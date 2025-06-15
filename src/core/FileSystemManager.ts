import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { getDefaultPromptDirectory } from "../config";

export interface FileSystemOperation {
  path: string;
  operation: "create" | "delete" | "read" | "write";
  timestamp: number;
}

export class FileSystemManager {
  private readonly defaultPromptManagerDir = ".prompt_manager";

  /**
   * Get the prompt manager directory path
   */
  public getPromptManagerPath(): string | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders || workspaceFolders.length === 0) {
      console.log("FileSystemManager: No workspace folders available");
      return undefined;
    }

    // Log the workspace context for debugging
    const workspaceName = vscode.workspace.name;
    const isWorkspaceFile = vscode.workspace.workspaceFile !== undefined;

    console.log(
      `FileSystemManager: Workspace detection - Name: ${workspaceName}, IsWorkspaceFile: ${isWorkspaceFile}, Folders: ${workspaceFolders.length}`
    );

    // Use the first workspace folder (works for both single folder and workspace scenarios)
    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    console.log(`FileSystemManager: Using workspace root: ${workspaceRoot}`);

    // Use configuration setting for directory name
    const dirName = getDefaultPromptDirectory();

    const promptPath = path.join(workspaceRoot, dirName);
    console.log(`FileSystemManager: Prompt manager path: ${promptPath}`);

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
      if (!fs.existsSync(promptPath)) {
        await fs.promises.mkdir(promptPath, { recursive: true });
        await this.createReadmeFile(promptPath);
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
      return await fs.promises.readFile(filePath, "utf8");
    } catch (error) {
      console.error(`Failed to read file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Write file content
   */
  public async writeFile(filePath: string, content: string): Promise<void> {
    try {
      await fs.promises.writeFile(filePath, content, "utf8");
    } catch (error) {
      console.error(`Failed to write file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Delete file
   */
  public async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.promises.unlink(filePath);
    } catch (error) {
      console.error(`Failed to delete file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Create directory
   */
  public async createDirectory(dirPath: string): Promise<void> {
    try {
      await fs.promises.mkdir(dirPath, { recursive: true });
    } catch (error) {
      console.error(`Failed to create directory ${dirPath}:`, error);
      throw error;
    }
  }

  /**
   * Get file stats
   */
  public async getFileStats(filePath: string): Promise<fs.Stats> {
    try {
      return await fs.promises.stat(filePath);
    } catch (error) {
      console.error(`Failed to get stats for ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Check if file exists
   */
  public fileExists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  /**
   * Read directory contents
   */
  public async readDirectory(dirPath: string): Promise<fs.Dirent[]> {
    try {
      return await fs.promises.readdir(dirPath, { withFileTypes: true });
    } catch (error) {
      console.error(`Failed to read directory ${dirPath}:`, error);
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
          console.warn(`Failed to read ${filePath}:`, error);
          return { filePath, content: "" };
        }
      });

      const results_array = await Promise.all(promises);
      results_array.forEach(({ filePath, content }) => {
        results.set(filePath, content);
      });
    } catch (error) {
      console.error("Batch read failed:", error);
    }

    return results;
  }

  /**
   * Create the default README file
   */
  private async createReadmeFile(promptPath: string): Promise<void> {
    const readmePath = path.join(promptPath, "README.md");
    const readmeContent = `# Prompt Manager

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

    try {
      await this.writeFile(readmePath, readmeContent);
    } catch (error) {
      console.error("Failed to create README.md:", error);
    }
  }
}
