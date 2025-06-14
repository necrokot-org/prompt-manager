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
    // Use configuration setting for directory name
    const config = vscode.workspace.getConfiguration("promptManager");
    const dirName = config.get<string>(
      "defaultPromptDirectory",
      ".prompt_manager"
    );
    return path.join(this.workspaceRoot, dirName);
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

  private normalizeFileName(fileName: string): string {
    const config = vscode.workspace.getConfiguration("promptManager");
    const namingPattern = config.get<string>("fileNamingPattern", "kebab-case");

    switch (namingPattern) {
      case "snake_case":
        return fileName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "");
      case "kebab-case":
        return fileName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
      case "original":
      default:
        return fileName;
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

      // Sort folders alphabetically, files by configured sort method
      folders.sort((a, b) => a.name.localeCompare(b.name));

      const config = vscode.workspace.getConfiguration("promptManager");
      const sortBy = config.get<string>("sortPromptsBy", "created");

      switch (sortBy) {
        case "name":
          rootPrompts.sort((a, b) => a.title.localeCompare(b.title));
          break;
        case "created":
        default:
          rootPrompts.sort((a, b) => b.created.getTime() - a.created.getTime());
          break;
      }

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

      const config = vscode.workspace.getConfiguration("promptManager");
      const sortBy = config.get<string>("sortPromptsBy", "created");

      switch (sortBy) {
        case "name":
          return prompts.sort((a, b) => a.title.localeCompare(b.title));
        case "created":
        default:
          return prompts.sort(
            (a, b) => b.created.getTime() - a.created.getTime()
          );
      }
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
    const sanitizedName = this.normalizeFileName(fileName);
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

    const now = new Date();
    const frontMatter = `---
title: "${fileName}"
description: ""
tags: []
created: "${now.toISOString()}"
---

# ${fileName}

Write your prompt here...
`;

    try {
      await fs.promises.writeFile(filePath, frontMatter, "utf8");
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

    const sanitizedName = this.normalizeFileName(folderName);
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
