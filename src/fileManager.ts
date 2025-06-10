import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

export interface PromptFile {
  name: string;
  title: string;
  path: string;
  description?: string;
  tags: string[];
  created: Date;
  modified: Date;
  fileSize: number;
  isDirectory: boolean;
}

export interface PromptFolder {
  name: string;
  path: string;
  prompts: PromptFile[];
}

export interface PromptStructure {
  folders: PromptFolder[];
  rootPrompts: PromptFile[];
}

export class FileManager {
  private readonly promptManagerDir = ".prompt_manager";
  private workspaceRoot: string | undefined;

  constructor() {
    this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  }

  public getPromptManagerPath(): string | undefined {
    if (!this.workspaceRoot) {
      return undefined;
    }
    return path.join(this.workspaceRoot, this.promptManagerDir);
  }

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
created: "2024-01-15T10:00:00Z"
modified: "2024-01-15T10:00:00Z"
---

# Code Review Helper

Your prompt content goes here...
\`\`\`

Happy prompting!
`;

    try {
      await fs.promises.writeFile(readmePath, readmeContent, "utf8");
    } catch (error) {
      console.error("Failed to create README.md:", error);
    }
  }

  public async scanPrompts(): Promise<PromptStructure> {
    const promptPath = this.getPromptManagerPath();
    if (!promptPath || !fs.existsSync(promptPath)) {
      return { folders: [], rootPrompts: [] };
    }

    try {
      const folders: PromptFolder[] = [];
      const rootPrompts: PromptFile[] = [];
      const items = await fs.promises.readdir(promptPath, {
        withFileTypes: true,
      });

      for (const item of items) {
        const itemPath = path.join(promptPath, item.name);

        if (item.isDirectory()) {
          const folderPrompts = await this.scanFolderPrompts(itemPath);
          folders.push({
            name: item.name,
            path: itemPath,
            prompts: folderPrompts,
          });
        } else if (
          item.isFile() &&
          item.name.endsWith(".md") &&
          item.name !== "README.md"
        ) {
          const promptFile = await this.parsePromptFile(itemPath);
          if (promptFile) {
            rootPrompts.push(promptFile);
          }
        }
      }

      // Sort folders alphabetically, files by modified date (newest first)
      folders.sort((a, b) => a.name.localeCompare(b.name));
      rootPrompts.sort((a, b) => b.modified.getTime() - a.modified.getTime());

      return { folders, rootPrompts };
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to scan prompts: ${error}`);
      return { folders: [], rootPrompts: [] };
    }
  }

  private async scanFolderPrompts(folderPath: string): Promise<PromptFile[]> {
    try {
      const items = await fs.promises.readdir(folderPath, {
        withFileTypes: true,
      });
      const prompts: PromptFile[] = [];

      for (const item of items) {
        if (item.isFile() && item.name.endsWith(".md")) {
          const itemPath = path.join(folderPath, item.name);
          const promptFile = await this.parsePromptFile(itemPath);
          if (promptFile) {
            prompts.push(promptFile);
          }
        }
      }

      return prompts.sort(
        (a, b) => b.modified.getTime() - a.modified.getTime()
      );
    } catch (error) {
      console.error(`Failed to scan folder prompts in ${folderPath}:`, error);
      return [];
    }
  }

  private async parsePromptFile(filePath: string): Promise<PromptFile | null> {
    try {
      const stats = await fs.promises.stat(filePath);
      const content = await fs.promises.readFile(filePath, "utf8");

      // Parse front matter if present
      const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      let metadata: any = {};

      if (frontMatterMatch) {
        try {
          // Simple YAML parsing for front matter
          const frontMatter = frontMatterMatch[1];
          const lines = frontMatter.split("\n");
          for (const line of lines) {
            const match = line.match(/^(\w+):\s*(.+)$/);
            if (match) {
              const [, key, value] = match;
              if (
                key === "tags" &&
                value.startsWith("[") &&
                value.endsWith("]")
              ) {
                // Parse tags array
                metadata[key] = value
                  .slice(1, -1)
                  .split(",")
                  .map((tag) => tag.trim().replace(/"/g, ""));
              } else {
                metadata[key] = value.replace(/"/g, "");
              }
            }
          }
        } catch (error) {
          console.error(`Failed to parse front matter in ${filePath}:`, error);
        }
      }

      const fileName = path.basename(filePath, ".md");

      return {
        name: fileName,
        title: metadata.title || fileName.replace(/-/g, " "),
        path: filePath,
        description: metadata.description,
        tags: metadata.tags || [],
        created: metadata.created
          ? new Date(metadata.created)
          : stats.birthtime,
        modified: metadata.modified ? new Date(metadata.modified) : stats.mtime,
        fileSize: stats.size,
        isDirectory: false,
      };
    } catch (error) {
      console.error(`Failed to parse prompt file ${filePath}:`, error);
      return null;
    }
  }

  public async createPromptFile(
    fileName: string,
    folderPath?: string
  ): Promise<string | null> {
    const promptPath = this.getPromptManagerPath();
    if (!promptPath) {
      return null;
    }

    await this.ensurePromptManagerDirectory();

    // Sanitize filename
    const sanitizedName = fileName
      .replace(/[^a-zA-Z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .toLowerCase();
    const fullFileName = `${sanitizedName}.md`;

    const targetDir = folderPath || promptPath;
    const filePath = path.join(targetDir, fullFileName);

    // Check if file already exists
    if (fs.existsSync(filePath)) {
      vscode.window.showWarningMessage(
        `Prompt file "${fullFileName}" already exists.`
      );
      return null;
    }

    const currentDate = new Date().toISOString();
    const template = `---
title: "${fileName}"
description: ""
tags: []
created: "${currentDate}"
modified: "${currentDate}"
---

# ${fileName}

Your prompt content goes here...
`;

    try {
      await fs.promises.writeFile(filePath, template, "utf8");
      return filePath;
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to create prompt file: ${error}`);
      return null;
    }
  }

  public async createFolder(folderName: string): Promise<string | null> {
    const promptPath = this.getPromptManagerPath();
    if (!promptPath) {
      return null;
    }

    await this.ensurePromptManagerDirectory();

    const sanitizedName = folderName
      .replace(/[^a-zA-Z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .toLowerCase();
    const folderPath = path.join(promptPath, sanitizedName);

    if (fs.existsSync(folderPath)) {
      vscode.window.showWarningMessage(
        `Folder "${sanitizedName}" already exists.`
      );
      return null;
    }

    try {
      await fs.promises.mkdir(folderPath, { recursive: true });
      return folderPath;
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to create folder: ${error}`);
      return null;
    }
  }

  public async deletePromptFile(filePath: string): Promise<boolean> {
    try {
      await fs.promises.unlink(filePath);
      return true;
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to delete prompt file: ${error}`);
      return false;
    }
  }
}
