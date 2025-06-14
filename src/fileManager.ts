import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

export interface PromptFile {
  name: string;
  title: string;
  path: string;
  description?: string;
  tags: string[];
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
  private readonly defaultPromptManagerDir = ".prompt_manager";
  private cachedPromptStructure: PromptStructure | null = null;
  private indexBuilt = false;
  private indexBuildPromise: Promise<void> | null = null;

  public getPromptManagerPath(): string | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders || workspaceFolders.length === 0) {
      console.log("FileManager: No workspace folders available");
      return undefined;
    }

    // Log the workspace context for debugging
    const workspaceName = vscode.workspace.name;
    const isWorkspaceFile = vscode.workspace.workspaceFile !== undefined;

    console.log(
      `FileManager: Workspace detection - Name: ${workspaceName}, IsWorkspaceFile: ${isWorkspaceFile}, Folders: ${workspaceFolders.length}`
    );

    // Use the first workspace folder (works for both single folder and workspace scenarios)
    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    console.log(`FileManager: Using workspace root: ${workspaceRoot}`);

    // Use configuration setting for directory name
    const config = vscode.workspace.getConfiguration("promptManager");
    const dirName = config.get<string>(
      "defaultPromptDirectory",
      this.defaultPromptManagerDir
    );

    const promptPath = path.join(workspaceRoot, dirName);
    console.log(`FileManager: Prompt manager path: ${promptPath}`);

    return promptPath;
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

      // Build initial index after ensuring directory exists
      await this.buildIndex();
      return true;
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to create .prompt_manager directory: ${error}`
      );
      return false;
    }
  }

  /**
   * Build the in-memory index by scanning all prompt files
   * This is called once on initialization and after file system changes
   */
  public async buildIndex(): Promise<void> {
    // Prevent concurrent index builds
    if (this.indexBuildPromise) {
      return this.indexBuildPromise;
    }

    this.indexBuildPromise = this.performIndexBuild();
    await this.indexBuildPromise;
    this.indexBuildPromise = null;
  }

  private async performIndexBuild(): Promise<void> {
    console.log("FileManager: Building in-memory index...");
    const promptPath = this.getPromptManagerPath();
    if (!promptPath || !fs.existsSync(promptPath)) {
      this.cachedPromptStructure = { folders: [], rootPrompts: [] };
      this.indexBuilt = true;
      return;
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

      // Sort folders alphabetically, files by name
      folders.sort((a, b) => a.name.localeCompare(b.name));
      rootPrompts.sort((a, b) => a.title.localeCompare(b.title));

      this.cachedPromptStructure = { folders, rootPrompts };
      this.indexBuilt = true;
      console.log(
        `FileManager: Index built - ${folders.length} folders, ${rootPrompts.length} root prompts`
      );
    } catch (error) {
      console.error("Failed to build index:", error);
      this.cachedPromptStructure = { folders: [], rootPrompts: [] };
      this.indexBuilt = true;
    }
  }

  /**
   * Invalidate the cached index - call this when files are added/removed/changed
   */
  public invalidateIndex(): void {
    console.log("FileManager: Invalidating index cache");
    this.cachedPromptStructure = null;
    this.indexBuilt = false;
  }

  /**
   * Get the current prompt structure from memory index
   * Builds index if not yet built
   */
  public async scanPrompts(): Promise<PromptStructure> {
    // If index not built yet, build it now
    if (!this.indexBuilt) {
      await this.buildIndex();
    }

    // Return cached structure or empty structure if failed
    return this.cachedPromptStructure || { folders: [], rootPrompts: [] };
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

      return prompts.sort((a, b) => a.title.localeCompare(b.title));
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

    const frontMatter = `---
title: "${fileName}"
description: ""
tags: []
---

# ${fileName}

Write your prompt here...
`;

    try {
      await fs.promises.writeFile(filePath, frontMatter, "utf8");

      // Invalidate cache and rebuild index since we added a new file
      this.invalidateIndex();
      await this.buildIndex();

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

      // Invalidate cache and rebuild index since we added a new folder
      this.invalidateIndex();
      await this.buildIndex();

      return folderPath;
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to create folder: ${error}`);
      return null;
    }
  }

  public async deletePromptFile(filePath: string): Promise<boolean> {
    try {
      await fs.promises.unlink(filePath);

      // Invalidate cache and rebuild index since we deleted a file
      this.invalidateIndex();
      await this.buildIndex();

      return true;
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to delete prompt file: ${error}`);
      return false;
    }
  }
}
