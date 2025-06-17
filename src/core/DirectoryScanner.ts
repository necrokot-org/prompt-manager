import * as path from "path";
import fg from "fast-glob";
import { FileSystemManager } from "./FileSystemManager";
import { PromptParser, ParsedPromptContent } from "./PromptParser";
import { eventBus } from "./ExtensionBus";

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
  excludePatterns?: string[];
}

export class DirectoryScanner {
  private fileSystemManager: FileSystemManager;
  private parser: PromptParser;
  private cachedStructure: PromptStructure | null = null;
  private indexBuilt = false;
  private indexBuildPromise: Promise<void> | null = null;
  /** Debounce timer for index rebuilds */
  private rebuildTimer: NodeJS.Timeout | null = null;
  /** Debounce delay in milliseconds */
  private readonly rebuildDebounceMs = 250;

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
   * Scan a specific directory for prompts using fast-glob
   */
  public async scanDirectory(
    dirPath: string,
    options: ScanOptions = {}
  ): Promise<PromptStructure> {
    const {
      includeHidden = false,
      maxDepth = 10,
      fileExtensions = [".md"],
      excludePatterns = [],
    } = options;

    try {
      if (!this.fileSystemManager.fileExists(dirPath)) {
        return { folders: [], rootPrompts: [] };
      }

      // Build glob patterns for file extensions
      const patterns = fileExtensions.map((ext) =>
        ext.startsWith(".") ? `**/*${ext}` : `**/*.${ext}`
      );

      // Default ignore patterns plus user excludes
      const ignore = ["**/README.md", ...excludePatterns];

      // Get all matching files using fast-glob
      const entries = await fg(patterns, {
        cwd: dirPath,
        dot: includeHidden,
        deep: maxDepth,
        ignore,
        onlyFiles: true,
        absolute: false, // We'll resolve paths ourselves for consistency
      });

      // Parse all found files into PromptFile objects
      const allPromptFiles: PromptFile[] = [];
      for (const relativePath of entries) {
        const fullPath = path.join(dirPath, relativePath);
        const promptFile = await this.parsePromptFile(fullPath);
        if (promptFile) {
          allPromptFiles.push(promptFile);
        }
      }

      // Organize files into folders and root prompts
      const folders: PromptFolder[] = [];
      const rootPrompts: PromptFile[] = [];
      const folderMap = new Map<string, PromptFile[]>();

      for (const file of allPromptFiles) {
        const relativePath = path.relative(dirPath, file.path);
        const dirName = path.dirname(relativePath);

        if (dirName === "." || dirName === "") {
          // File is in root directory
          rootPrompts.push(file);
        } else {
          // File is in a subdirectory
          const topLevelDir = dirName.split(path.sep)[0];
          if (!folderMap.has(topLevelDir)) {
            folderMap.set(topLevelDir, []);
          }
          folderMap.get(topLevelDir)!.push(file);
        }
      }

      // Also scan for empty directories
      const dirEntries = await this.fileSystemManager.readDirectory(dirPath);
      for (const entry of dirEntries) {
        if (entry.isDirectory() && !folderMap.has(entry.name)) {
          // This is a directory that doesn't contain any prompt files
          folders.push({
            name: entry.name,
            path: path.join(dirPath, entry.name),
            prompts: [],
          });
        }
      }

      // Convert folder map to PromptFolder array
      for (const [folderName, prompts] of folderMap) {
        folders.push({
          name: folderName,
          path: path.join(dirPath, folderName),
          prompts: prompts.sort((a, b) => a.title.localeCompare(b.title)),
        });
      }

      // Sort results
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
   * Scan a specific folder for prompts - now simplified using fast-glob
   */
  public async scanFolderPrompts(
    folderPath: string,
    options: ScanOptions = {}
  ): Promise<PromptFile[]> {
    try {
      const { fileExtensions = [".md"] } = options;

      // Use fast-glob to get files in this specific folder (depth 1)
      const patterns = fileExtensions.map((ext) =>
        ext.startsWith(".") ? `*${ext}` : `*.${ext}`
      );

      const entries = await fg(patterns, {
        cwd: folderPath,
        dot: options.includeHidden || false,
        deep: 1, // Only direct children, no subdirectories
        onlyFiles: true,
        absolute: false,
      });

      const prompts: PromptFile[] = [];
      for (const fileName of entries) {
        const fullPath = path.join(folderPath, fileName);
        const promptFile = await this.parsePromptFile(fullPath);
        if (promptFile) {
          prompts.push(promptFile);
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

      const fileName = path.basename(filePath, path.extname(filePath));
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
   * Invalidate the cached index - call this when files are added/removed/changed
   */
  public invalidateIndex(): void {
    console.log("DirectoryScanner: Invalidating index cache");

    // Mark cache as stale
    this.cachedStructure = null;
    this.indexBuilt = false;

    // Debounce rebuilds to avoid thrashing on rapid FS events
    if (this.rebuildTimer) {
      clearTimeout(this.rebuildTimer);
    }

    this.rebuildTimer = setTimeout(async () => {
      this.rebuildTimer = null;

      try {
        await this.buildIndex();

        // Notify UI layer that a fresh structure is available
        eventBus.emit("ui.tree.refresh.requested", { reason: "file-change" });
      } catch (error) {
        console.error("DirectoryScanner: Failed to rebuild index", error);
      }
    }, this.rebuildDebounceMs);
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
}
