import * as path from "path";
import { FileSystemManager } from "@infra/fs/FileSystemManager";
import { eventBus } from "@infra/vscode/ExtensionBus";
import { log } from "@infra/vscode/log";
import { FilesystemWalker } from "../scanner/FilesystemWalker";
import { PromptOrganizer } from "../scanner/PromptOrganizer";
import { IndexManager } from "../scanner/IndexManager";
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
 *  – IndexManager: encapsulates all cache operations and index building logic
 *  – FilesystemWalker: converts prompt files on disk to PromptFile objects (via IndexManager)
 *  – PromptOrganizer: groups PromptFile objects into folders / root prompts (via IndexManager)
 */
export class DirectoryScanner {
  private walker: FilesystemWalker;
  private organizer: PromptOrganizer;
  private indexManager: IndexManager;

  constructor(private fileSystemManager: FileSystemManager) {
    this.walker = new FilesystemWalker(fileSystemManager);
    this.organizer = new PromptOrganizer(fileSystemManager);
    this.indexManager = new IndexManager(
      fileSystemManager,
      this.walker,
      this.organizer
    );
  }

  /**
   * Force a rebuild of the cached index immediately.
   */
  public async buildIndex(): Promise<void> {
    return this.indexManager.buildIndex();
  }

  /**
   * Get the current PromptStructure from cache, rebuilding if necessary.
   */
  public async scanPrompts(): Promise<PromptStructure> {
    return this.indexManager.getStructure();
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
   * Rebuild the index with debounced cache invalidation.
   * Combines cache invalidation, index building, and UI refresh into a single atomic operation.
   * A ui.tree.refresh.requested event will be emitted once finished.
   */
  public async rebuildIndex(): Promise<void> {
    return this.indexManager.rebuildIndex();
  }

  /**
   * Force immediate index rebuild (bypasses debouncing).
   * Combines cache invalidation, index building, and UI refresh into a single atomic operation.
   * Use this for operations like folder moves that require immediate refresh.
   */
  public async rebuildIndexForce(): Promise<void> {
    return this.indexManager.rebuildIndexForce();
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
}
