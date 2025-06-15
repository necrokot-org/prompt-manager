import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { normalizeFileName, FileNamingPattern } from "./utils/string";
import { getDefaultPromptDirectory, getFileNamingPattern } from "./config";

export interface PromptFile {
  name: string;
  title: string;
  path: string;
  description?: string;
  tags: string[];
  fileSize: number;
  isDirectory: boolean;
}

// Add new interface for enhanced search capabilities
export interface SearchablePromptFile extends PromptFile {
  content?: string; // Cached content for search
  frontMatter?: any; // Parsed YAML front matter
  bodyContent?: string; // Content without front matter
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

  // Add content cache for search performance
  private contentCache: Map<string, SearchablePromptFile> = new Map();
  private cacheTimestamps: Map<string, number> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

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
    const dirName = getDefaultPromptDirectory();

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
    // Also clear search cache when index is invalidated
    this.clearSearchCache();
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

      // Use the centralized YAML parsing method
      const { frontMatter: metadata } = this.parseYamlContent(content);
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
    const sanitizedName = this.getSanitizedName(fileName);
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

    const sanitizedName = this.getSanitizedName(folderName);
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

  /**
   * Enhanced content search with caching and YAML parsing
   */
  public async searchInContent(
    query: string,
    options: {
      caseSensitive?: boolean;
      exact?: boolean;
      includeYaml?: boolean;
    } = {}
  ): Promise<ContentSearchResult[]> {
    const {
      caseSensitive = false,
      exact = false,
      includeYaml = false,
    } = options;
    const results: ContentSearchResult[] = [];

    // Ensure index is built
    if (!this.indexBuilt) {
      await this.buildIndex();
    }

    const structure = await this.scanPrompts();
    const allFiles: PromptFile[] = [
      ...structure.rootPrompts,
      ...structure.folders.flatMap((folder) => folder.prompts),
    ];

    for (const file of allFiles) {
      const searchableFile = await this.getSearchableFile(file.path);
      if (!searchableFile) {
        continue;
      }

      const matches = this.findContentMatches(searchableFile, query, {
        caseSensitive,
        exact,
        includeYaml,
      });

      if (matches.length > 0) {
        const score = this.calculateSearchScore(matches, query);
        results.push({
          file,
          score,
          matches,
        });
      }
    }

    // Sort by relevance score (highest first)
    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Enhanced title search with YAML front matter parsing
   */
  public async searchInTitle(
    query: string,
    options: {
      caseSensitive?: boolean;
      exact?: boolean;
    } = {}
  ): Promise<ContentSearchResult[]> {
    const { caseSensitive = false, exact = false } = options;
    const results: ContentSearchResult[] = [];

    if (!this.indexBuilt) {
      await this.buildIndex();
    }

    const structure = await this.scanPrompts();
    const allFiles: PromptFile[] = [
      ...structure.rootPrompts,
      ...structure.folders.flatMap((folder) => folder.prompts),
    ];

    for (const file of allFiles) {
      const searchableFile = await this.getSearchableFile(file.path);
      if (!searchableFile) {
        continue;
      }

      const matches = this.findTitleMatches(searchableFile, query, {
        caseSensitive,
        exact,
      });

      if (matches.length > 0) {
        const score = this.calculateSearchScore(matches, query);
        results.push({
          file,
          score,
          matches,
        });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Get or create cached searchable file data
   */
  private async getSearchableFile(
    filePath: string
  ): Promise<SearchablePromptFile | null> {
    const cacheKey = filePath;
    const now = Date.now();

    // Check if cached version is still valid
    if (this.contentCache.has(cacheKey)) {
      const timestamp = this.cacheTimestamps.get(cacheKey) || 0;
      if (now - timestamp < this.CACHE_TTL) {
        return this.contentCache.get(cacheKey) || null;
      }
    }

    try {
      // Read and parse file
      const content = await fs.promises.readFile(filePath, "utf8");
      const parsed = this.parseYamlContent(content);

      const searchableFile: SearchablePromptFile = {
        ...(await this.parsePromptFile(filePath))!,
        content,
        frontMatter: parsed.frontMatter,
        bodyContent: parsed.content,
      };

      // Cache the result
      this.contentCache.set(cacheKey, searchableFile);
      this.cacheTimestamps.set(cacheKey, now);

      return searchableFile;
    } catch (error) {
      console.error(`Failed to read file for search: ${filePath}`, error);
      return null;
    }
  }

  /**
   * Parse YAML front matter and content
   */
  private parseYamlContent(content: string): {
    frontMatter: any;
    content: string;
  } {
    const lines = content.split("\n");

    // Check if file starts with YAML front matter
    if (lines[0] === "---") {
      const endIndex = lines.findIndex(
        (line, index) => index > 0 && line === "---"
      );

      if (endIndex > 0) {
        const yamlLines = lines.slice(1, endIndex);
        const bodyLines = lines.slice(endIndex + 1);

        try {
          // Simple YAML parsing for common front matter fields
          const frontMatter: any = {};

          for (const line of yamlLines) {
            const colonIndex = line.indexOf(":");
            if (colonIndex > 0) {
              const key = line.substring(0, colonIndex).trim();
              let value = line.substring(colonIndex + 1).trim();

              // Remove quotes if present
              if (
                (value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))
              ) {
                value = value.slice(1, -1);
              }

              // Handle arrays (simple format: ["item1", "item2"])
              if (value.startsWith("[") && value.endsWith("]")) {
                try {
                  frontMatter[key] = JSON.parse(value);
                } catch {
                  frontMatter[key] = value;
                }
              } else {
                frontMatter[key] = value;
              }
            }
          }

          return {
            frontMatter,
            content: bodyLines.join("\n").trim(),
          };
        } catch (error) {
          console.warn("Failed to parse YAML front matter:", error);
        }
      }
    }

    return {
      frontMatter: {},
      content: content.trim(),
    };
  }

  /**
   * Find matches in file content
   */
  private findContentMatches(
    file: SearchablePromptFile,
    query: string,
    options: { caseSensitive: boolean; exact: boolean; includeYaml: boolean }
  ): SearchMatch[] {
    const matches: SearchMatch[] = [];
    const searchQuery = options.caseSensitive ? query : query.toLowerCase();

    // Search in body content (excluding YAML)
    if (file.bodyContent) {
      const content = options.caseSensitive
        ? file.bodyContent
        : file.bodyContent.toLowerCase();
      const contentMatches = this.findTextMatches(
        content,
        searchQuery,
        "content",
        options.exact
      );
      matches.push(...contentMatches);
    }

    // Search in YAML front matter if requested
    if (options.includeYaml && file.frontMatter) {
      const yamlText = JSON.stringify(file.frontMatter);
      const yamlContent = options.caseSensitive
        ? yamlText
        : yamlText.toLowerCase();
      const yamlMatches = this.findTextMatches(
        yamlContent,
        searchQuery,
        "content",
        options.exact
      );
      matches.push(...yamlMatches);
    }

    return matches;
  }

  /**
   * Find matches in file title
   */
  private findTitleMatches(
    file: SearchablePromptFile,
    query: string,
    options: { caseSensitive: boolean; exact: boolean }
  ): SearchMatch[] {
    const matches: SearchMatch[] = [];
    const searchQuery = options.caseSensitive ? query : query.toLowerCase();

    // Search in title from front matter or filename
    const title = file.frontMatter?.title || file.title;
    if (title) {
      const titleText = options.caseSensitive ? title : title.toLowerCase();
      const titleMatches = this.findTextMatches(
        titleText,
        searchQuery,
        "title",
        options.exact
      );
      matches.push(...titleMatches);
    }

    // Search in description
    if (file.description) {
      const descText = options.caseSensitive
        ? file.description
        : file.description.toLowerCase();
      const descMatches = this.findTextMatches(
        descText,
        searchQuery,
        "description",
        options.exact
      );
      matches.push(...descMatches);
    }

    // Search in tags
    if (file.tags && file.tags.length > 0) {
      const tagsText = file.tags.join(" ");
      const tagsContent = options.caseSensitive
        ? tagsText
        : tagsText.toLowerCase();
      const tagMatches = this.findTextMatches(
        tagsContent,
        searchQuery,
        "tags",
        options.exact
      );
      matches.push(...tagMatches);
    }

    return matches;
  }

  /**
   * Find text matches with context
   */
  private findTextMatches(
    text: string,
    query: string,
    type: SearchMatch["type"],
    exact: boolean
  ): SearchMatch[] {
    const matches: SearchMatch[] = [];

    if (exact) {
      // Exact word matching
      const regex = new RegExp(`\\b${this.escapeRegex(query)}\\b`, "gi");
      let match;

      while ((match = regex.exec(text)) !== null) {
        matches.push({
          type,
          position: match.index,
          length: match[0].length,
          context: this.extractContext(text, match.index, match[0].length),
        });
      }
    } else {
      // Fuzzy matching
      let startIndex = 0;
      while (true) {
        const index = text.indexOf(query, startIndex);
        if (index === -1) {
          break;
        }

        matches.push({
          type,
          position: index,
          length: query.length,
          context: this.extractContext(text, index, query.length),
        });

        startIndex = index + 1;
      }
    }

    return matches;
  }

  /**
   * Extract context around a match
   */
  private extractContext(
    text: string,
    position: number,
    length: number,
    contextSize: number = 50
  ): string {
    const start = Math.max(0, position - contextSize);
    const end = Math.min(text.length, position + length + contextSize);

    let context = text.substring(start, end);

    // Add ellipsis if we're not at the beginning/end
    if (start > 0) {
      context = "..." + context;
    }
    if (end < text.length) {
      context = context + "...";
    }

    return context;
  }

  /**
   * Calculate relevance score for search results
   */
  private calculateSearchScore(matches: SearchMatch[], query: string): number {
    let score = 0;

    for (const match of matches) {
      // Base score based on match type
      switch (match.type) {
        case "title":
          score += 100;
          break;
        case "description":
          score += 50;
          break;
        case "tags":
          score += 75;
          break;
        case "content":
          score += 25;
          break;
      }

      // Bonus for exact matches
      if (match.length === query.length) {
        score += 25;
      }

      // Bonus for matches at word boundaries
      if (match.context.includes(" " + query + " ")) {
        score += 15;
      }
    }

    return score;
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Clear search cache (call when files are modified)
   */
  public clearSearchCache(): void {
    this.contentCache.clear();
    this.cacheTimestamps.clear();
  }

  /**
   * Get sanitized filename using the configured naming pattern
   */
  private getSanitizedName(name: string): string {
    const namingPattern = getFileNamingPattern();
    return normalizeFileName(name, namingPattern);
  }
}
