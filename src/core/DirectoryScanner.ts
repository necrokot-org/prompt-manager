import * as path from "path";
import { FileSystemManager } from "./FileSystemManager";
import { eventBus } from "./ExtensionBus";
import { log } from "./log";
import { FilesystemWalker } from "../scanner/FilesystemWalker";
import { PromptOrganizer } from "../scanner/PromptOrganizer";
import { IndexCache } from "../scanner/IndexCache";
import {
  PromptFile,
  PromptFolder,
  PromptStructure,
  ScanOptions,
} from "../scanner/types";

export type {
  PromptFile,
  PromptFolder,
  PromptStructure,
  ScanOptions,
} from "../scanner/types";

/**
 * High-level orchestration class that delegates the heavy work of walking the
 * filesystem, organising prompts and caching the resulting structure to
 * focused collaborators.
 *
 *  – FilesystemWalker: converts prompt files on disk to PromptFile objects
 *  – PromptOrganizer: groups PromptFile objects into folders / root prompts
 *  – IndexCache: keeps a debounced, in-memory copy of the PromptStructure
 */
export class DirectoryScanner {
  private walker: FilesystemWalker;
  private organizer: PromptOrganizer;
  private cache: IndexCache;
  private indexBuildPromise: Promise<void> | null = null;

  constructor(private fileSystemManager: FileSystemManager) {
    this.walker = new FilesystemWalker(fileSystemManager);
    this.organizer = new PromptOrganizer(fileSystemManager);
    this.cache = new IndexCache();
  }

  /**
   * Force a rebuild of the cached index immediately.
   */
  public async buildIndex(): Promise<void> {
    // Prevent concurrent builds
    if (this.indexBuildPromise) {
      return this.indexBuildPromise;
    }

    this.indexBuildPromise = this.performIndexBuild();
    await this.indexBuildPromise;
    this.indexBuildPromise = null;
  }

  /**
   * Get the current PromptStructure from cache, rebuilding if necessary.
   */
  public async scanPrompts(): Promise<PromptStructure> {
    if (!this.cache.isValid()) {
      await this.buildIndex();
    }
    return this.cache.get() || { folders: [], rootPrompts: [] };
  }

  /**
   * Scan an arbitrary directory on demand.
   * Bypasses the cache and delegates directly to the walker & organiser.
   */
  public async scanDirectory(
    dirPath: string,
    options: ScanOptions = {}
  ): Promise<PromptStructure> {
    const promptFiles = await this.walker.scanDirectory(dirPath, options);
    return await this.organizer.organize(promptFiles, dirPath);
  }

  /**
   * Return all PromptFile objects as a flat array.
   */
  public async getAllPromptFiles(): Promise<PromptFile[]> {
    const structure = await this.scanPrompts();
    return [
      ...structure.rootPrompts,
      ...structure.folders.flatMap((f) => f.prompts),
    ];
  }

  /**
   * Filter PromptFile objects using an arbitrary predicate.
   */
  public async findPromptFiles(
    predicate: (file: PromptFile) => boolean
  ): Promise<PromptFile[]> {
    const all = await this.getAllPromptFiles();
    return all.filter(predicate);
  }

  /**
   * Get folder-only representation of the prompt hierarchy.
   */
  public async getFolderStructure(): Promise<PromptFolder[]> {
    const structure = await this.scanPrompts();
    return structure.folders;
  }

  /**
   * Invalidate the current cache and schedule a debounced rebuild.
   * A ui.tree.refresh.requested event will be emitted once finished.
   */
  public invalidateIndex(): void {
    this.cache.invalidate(async () => {
      await this.buildIndex();
      eventBus.emit("ui.tree.refresh.requested", { reason: "file-change" });
    });
  }

  /**
   * Compute basic statistics for any directory (defaulting to the prompt root).
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
      ...structure.folders.flatMap((f) => f.prompts),
    ];

    const stats = {
      totalFiles: allFiles.length,
      totalFolders: structure.folders.length,
      totalSize: allFiles.reduce((sum, f) => sum + f.fileSize, 0),
      fileTypes: {} as Record<string, number>,
    };

    for (const file of allFiles) {
      const ext = path.extname(file.path).toLowerCase();
      stats.fileTypes[ext] = (stats.fileTypes[ext] || 0) + 1;
    }

    return stats;
  }

  // Internal helpers
  private async performIndexBuild(): Promise<void> {
    log.debug("DirectoryScanner: Building in-memory index ...");
    const promptRoot = this.fileSystemManager.getPromptManagerPath();

    if (!promptRoot || !this.fileSystemManager.fileExists(promptRoot)) {
      this.cache.set({ folders: [], rootPrompts: [] });
      return;
    }

    try {
      const promptFiles = await this.walker.scanDirectory(promptRoot);
      const structure = await this.organizer.organize(promptFiles, promptRoot);
      this.cache.set(structure);

      log.debug(
        `DirectoryScanner: Index built – ${structure.folders.length} folders, ${structure.rootPrompts.length} root prompts`
      );
    } catch (error) {
      log.error("DirectoryScanner: Failed to build index", error);
      this.cache.set({ folders: [], rootPrompts: [] });
    }
  }
}
