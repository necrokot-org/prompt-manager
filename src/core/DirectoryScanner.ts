import * as path from "path";
import { FileSystemManager } from "./FileSystemManager";
import { PromptParser, ParsedPromptContent } from "./PromptParser";

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

export interface ScanOptions {
  includeHidden?: boolean;
  maxDepth?: number;
  fileExtensions?: string[];
}

export class DirectoryScanner {
  private fileSystemManager: FileSystemManager;
  private parser: PromptParser;
  private cachedStructure: PromptStructure | null = null;
  private indexBuilt = false;
  private indexBuildPromise: Promise<void> | null = null;

  constructor(fileSystemManager: FileSystemManager) {
    this.fileSystemManager = fileSystemManager;
    this.parser = new PromptParser();
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
    return this.cachedStructure || { folders: [], rootPrompts: [] };
  }

  /**
   * Scan a specific directory for prompts
   */
  public async scanDirectory(
    dirPath: string,
    options: ScanOptions = {}
  ): Promise<PromptStructure> {
    const {
      includeHidden = false,
      maxDepth = 10,
      fileExtensions = [".md"],
    } = options;

    try {
      const folders: PromptFolder[] = [];
      const rootPrompts: PromptFile[] = [];

      if (!this.fileSystemManager.fileExists(dirPath)) {
        return { folders, rootPrompts };
      }

      const items = await this.fileSystemManager.readDirectory(dirPath);

      for (const item of items) {
        // Skip hidden files/folders if not requested
        if (!includeHidden && item.name.startsWith(".")) {
          continue;
        }

        const itemPath = path.join(dirPath, item.name);

        if (item.isDirectory()) {
          const folderPrompts = await this.scanFolderPrompts(itemPath, options);
          folders.push({
            name: item.name,
            path: itemPath,
            prompts: folderPrompts,
          });
        } else if (
          item.isFile() &&
          this.isPromptFile(item.name, fileExtensions) &&
          item.name !== "README.md"
        ) {
          const promptFile = await this.parsePromptFile(itemPath);
          if (promptFile) {
            rootPrompts.push(promptFile);
          }
        }
      }

      // Sort folders alphabetically, files by title
      folders.sort((a, b) => a.name.localeCompare(b.name));
      rootPrompts.sort((a, b) => a.title.localeCompare(b.title));

      return { folders, rootPrompts };
    } catch (error) {
      console.error(`Failed to scan directory ${dirPath}:`, error);
      return { folders: [], rootPrompts: [] };
    }
  }

  /**
   * Get all prompt files as a flat array
   */
  public async getAllPromptFiles(): Promise<PromptFile[]> {
    const structure = await this.scanPrompts();
    const allFiles: PromptFile[] = [
      ...structure.rootPrompts,
      ...structure.folders.flatMap((folder) => folder.prompts),
    ];
    return allFiles;
  }

  /**
   * Find prompt files matching criteria
   */
  public async findPromptFiles(
    predicate: (file: PromptFile) => boolean
  ): Promise<PromptFile[]> {
    const allFiles = await this.getAllPromptFiles();
    return allFiles.filter(predicate);
  }

  /**
   * Get folder structure (directories only)
   */
  public async getFolderStructure(): Promise<PromptFolder[]> {
    const structure = await this.scanPrompts();
    return structure.folders;
  }

  /**
   * Scan a specific folder for prompts
   */
  public async scanFolderPrompts(
    folderPath: string,
    options: ScanOptions = {}
  ): Promise<PromptFile[]> {
    try {
      const { fileExtensions = [".md"] } = options;
      const items = await this.fileSystemManager.readDirectory(folderPath);
      const prompts: PromptFile[] = [];

      for (const item of items) {
        if (item.isFile() && this.isPromptFile(item.name, fileExtensions)) {
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

  /**
   * Parse a single prompt file
   */
  public async parsePromptFile(filePath: string): Promise<PromptFile | null> {
    try {
      const stats = await this.fileSystemManager.getFileStats(filePath);
      const content = await this.fileSystemManager.readFile(filePath);

      const fileName = path.basename(filePath, ".md");
      const parsed = this.parser.parsePromptContent(content, fileName);

      return {
        name: fileName,
        title: parsed.title,
        path: filePath,
        description: parsed.description,
        tags: parsed.tags,
        fileSize: stats.size,
        isDirectory: false,
      };
    } catch (error) {
      console.error(`Failed to parse prompt file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Watch directory for changes and auto-rebuild index
   */
  public watchDirectory(dirPath: string, callback?: () => void): void {
    // Note: This would typically use fs.watch() or similar
    // For now, we'll provide the interface for future implementation
    console.log(`Watching directory: ${dirPath}`);

    // Placeholder for file system watching
    // In a real implementation, this would:
    // 1. Set up fs.watch() on the directory
    // 2. Debounce file change events
    // 3. Call invalidateIndex() on changes
    // 4. Optionally trigger callback
  }

  /**
   * Invalidate the cached index - call this when files are added/removed/changed
   */
  public invalidateIndex(): void {
    console.log("DirectoryScanner: Invalidating index cache");
    this.cachedStructure = null;
    this.indexBuilt = false;
  }

  /**
   * Get directory statistics
   */
  public async getDirectoryStats(dirPath?: string): Promise<{
    totalFiles: number;
    totalFolders: number;
    totalSize: number;
    fileTypes: Record<string, number>;
  }> {
    const targetPath = dirPath || this.fileSystemManager.getPromptManagerPath();
    if (!targetPath || !this.fileSystemManager.fileExists(targetPath)) {
      return { totalFiles: 0, totalFolders: 0, totalSize: 0, fileTypes: {} };
    }

    const structure = dirPath
      ? await this.scanDirectory(targetPath)
      : await this.scanPrompts();
    const allFiles = [
      ...structure.rootPrompts,
      ...structure.folders.flatMap((folder) => folder.prompts),
    ];

    const stats = {
      totalFiles: allFiles.length,
      totalFolders: structure.folders.length,
      totalSize: allFiles.reduce((sum, file) => sum + file.fileSize, 0),
      fileTypes: {} as Record<string, number>,
    };

    // Count file types
    for (const file of allFiles) {
      const ext = path.extname(file.path).toLowerCase();
      stats.fileTypes[ext] = (stats.fileTypes[ext] || 0) + 1;
    }

    return stats;
  }

  // Private methods

  private async performIndexBuild(): Promise<void> {
    console.log("DirectoryScanner: Building in-memory index...");
    const promptPath = this.fileSystemManager.getPromptManagerPath();

    if (!promptPath || !this.fileSystemManager.fileExists(promptPath)) {
      this.cachedStructure = { folders: [], rootPrompts: [] };
      this.indexBuilt = true;
      return;
    }

    try {
      const structure = await this.scanDirectory(promptPath);
      this.cachedStructure = structure;
      this.indexBuilt = true;

      console.log(
        `DirectoryScanner: Index built - ${structure.folders.length} folders, ${structure.rootPrompts.length} root prompts`
      );
    } catch (error) {
      console.error("Failed to build index:", error);
      this.cachedStructure = { folders: [], rootPrompts: [] };
      this.indexBuilt = true;
    }
  }

  private isPromptFile(fileName: string, extensions: string[]): boolean {
    const ext = path.extname(fileName).toLowerCase();
    return extensions.includes(ext);
  }
}
