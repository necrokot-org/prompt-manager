import * as path from "path";
import { FileSystemManager } from "@infra/fs/FileSystemManager";
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
}
