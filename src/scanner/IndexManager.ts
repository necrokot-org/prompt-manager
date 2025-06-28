import { FileSystemManager } from "@infra/fs/FileSystemManager";
import { eventBus } from "@infra/vscode/ExtensionBus";
import { log } from "@infra/vscode/log";
import { FilesystemWalker } from "./FilesystemWalker";
import { PromptOrganizer } from "./PromptOrganizer";
import { PromptStructure } from "./types";

/**
 * IndexManager combines cache operations with index building logic.
 * It encapsulates all cache operations and depends on walker and organizer components.
 */
export class IndexManager {
  private structure: PromptStructure | null = null;
  private activePromise: Promise<void> | null = null;
  private activeResolve: (() => void) | null = null;
  private activeTimer: NodeJS.Timeout | null = null;
  private indexBuildPromise: Promise<void> | null = null;

  constructor(
    private fileSystemManager: FileSystemManager,
    private walker: FilesystemWalker,
    private organizer: PromptOrganizer,
    private debounceMs = 250
  ) {}

  // Cache operations
  public isValid(): boolean {
    return this.structure !== null;
  }

  public get(): PromptStructure | null {
    return this.structure;
  }

  public set(structure: PromptStructure): void {
    this.structure = structure;
  }

  /**
   * Mark cache as stale and return a promise that resolves after the debounce period.
   * If called multiple times during the debounce period, all calls will receive
   * the same promise instance.
   */
  public invalidate(): Promise<void> {
    if (this.activePromise) {
      return this.activePromise;
    }

    this.activePromise = new Promise<void>((resolve) => {
      this.activeResolve = resolve;
      this.activeTimer = setTimeout(() => {
        this.clear();
        this.activePromise = null;
        this.activeResolve = null;
        this.activeTimer = null;
        resolve();
      }, this.debounceMs);
    });

    return this.activePromise;
  }

  /**
   * Force immediate cache invalidation, bypassing debounce.
   * Resolves any active promise immediately.
   */
  public forceInvalidate(): Promise<void> {
    // Clear cache immediately
    this.clear();

    // If there's an active promise, resolve it immediately
    if (this.activePromise && this.activeResolve) {
      // Cancel the timer to prevent it from firing
      if (this.activeTimer) {
        clearTimeout(this.activeTimer);
        this.activeTimer = null;
      }

      // Resolve the active promise immediately
      const resolve = this.activeResolve;
      const promise = this.activePromise;

      // Clean up state
      this.activePromise = null;
      this.activeResolve = null;

      // Resolve the promise
      resolve();

      return promise;
    }

    // No active promise, return resolved promise
    return Promise.resolve();
  }

  // Index building operations
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
  public async getStructure(): Promise<PromptStructure> {
    if (!this.isValid()) {
      await this.buildIndex();
    }
    return this.get() || { folders: [], rootPrompts: [] };
  }

  /**
   * Rebuild the index with debounced cache invalidation.
   * Combines cache invalidation, index building, and UI refresh into a single atomic operation.
   * A ui.tree.refresh.requested event will be emitted once finished.
   */
  public async rebuildIndex(): Promise<void> {
    // Prevent concurrent rebuilds - this covers the entire operation
    if (this.indexBuildPromise) {
      return this.indexBuildPromise;
    }

    this.indexBuildPromise = this.performRebuild(false);
    await this.indexBuildPromise;
    this.indexBuildPromise = null;
  }

  /**
   * Force immediate index rebuild (bypasses debouncing).
   * Combines cache invalidation, index building, and UI refresh into a single atomic operation.
   * Use this for operations like folder moves that require immediate refresh.
   */
  public async rebuildIndexForce(): Promise<void> {
    // Prevent concurrent rebuilds - this covers the entire operation
    if (this.indexBuildPromise) {
      return this.indexBuildPromise;
    }

    this.indexBuildPromise = this.performRebuild(true);
    await this.indexBuildPromise;
    this.indexBuildPromise = null;
  }

  // Private methods
  private clear(): void {
    this.structure = null;
  }

  private async performIndexBuild(): Promise<void> {
    log.debug("IndexManager: Building in-memory index ...");
    const promptRoot = this.fileSystemManager.getPromptManagerPath();

    if (!promptRoot || !this.fileSystemManager.fileExists(promptRoot)) {
      this.set({ folders: [], rootPrompts: [] });
      return;
    }

    try {
      const promptFiles = await this.walker.scanDirectory(promptRoot);
      const structure = await this.organizer.organize(promptFiles, promptRoot);
      this.set(structure);

      log.debug(
        `IndexManager: Index built – ${structure.folders.length} folders, ${structure.rootPrompts.length} root prompts`
      );
    } catch (error) {
      log.error("IndexManager: Failed to build index", error);
      this.set({ folders: [], rootPrompts: [] });
    }
  }

  private async performRebuild(force: boolean): Promise<void> {
    log.debug(`IndexManager: ${force ? "Force " : ""}rebuilding index...`);

    try {
      // Step 1: Invalidate cache (with or without debouncing)
      if (force) {
        await this.forceInvalidate();
      } else {
        await this.invalidate();
      }

      // Step 2: Build the index
      await this.performIndexBuild();

      // Step 3: Emit UI refresh event
      eventBus.emit("ui.tree.refresh.requested", { reason: "file-change" });
    } catch (error) {
      log.error("IndexManager: Failed to rebuild index", error);
      // Ensure we have a valid structure even on error
      this.set({ folders: [], rootPrompts: [] });
      // Still emit the refresh event so UI reflects the error state
      eventBus.emit("ui.tree.refresh.requested", { reason: "file-change" });
    }
  }
}
