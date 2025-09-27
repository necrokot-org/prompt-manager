import { injectable, inject } from "tsyringe";
import { FileSystemManager } from "../../fs/FileSystemManager";
import { FilesystemWalker } from "../../../scanner/FilesystemWalker";
import { PromptOrganizer } from "../../../scanner/PromptOrganizer";
import { PromptStructure } from "../../../domain/model/PromptStructure";
import { Indexer } from "../../../application/ports/Indexer";
import { DI_TOKENS } from "../../di/di-tokens";

const EMPTY: PromptStructure = { folders: [], rootPrompts: [] };

@injectable()
export class IndexerImpl implements Indexer {
  private cache: PromptStructure | null = null;
  private walker: FilesystemWalker;
  private organizer: PromptOrganizer;

  private debounceMs = 250;
  private pendingDebounce: Promise<PromptStructure> | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private debounceResolve: ((v: PromptStructure) => void) | null = null;
  private debounceReject: ((e: any) => void) | null = null;

  private buildInFlight: Promise<PromptStructure> | null = null;

  constructor(
    @inject(DI_TOKENS.FileSystemManager)
    private readonly fs: FileSystemManager
  ) {
    this.walker = new FilesystemWalker(fs);
    this.organizer = new PromptOrganizer(fs);
  }

  public get(): PromptStructure | null {
    return this.cache;
  }

  public async build(): Promise<PromptStructure> {
    if (this.buildInFlight) {
      return this.buildInFlight;
    }
    this.buildInFlight = this.doBuild(true).finally(() => {
      this.buildInFlight = null;
    });
    return this.buildInFlight;
  }

  public async rebuild(): Promise<PromptStructure> {
    if (this.pendingDebounce) {
      return this.pendingDebounce;
    }
    this.pendingDebounce = new Promise<PromptStructure>((resolve, reject) => {
      this.debounceResolve = resolve;
      this.debounceReject = reject;
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }
      this.debounceTimer = setTimeout(async () => {
        this.debounceTimer = null;
        try {
          const result = await this.doBuild(false);
          resolve(result);
        } catch (e) {
          reject(e);
        } finally {
          this.pendingDebounce = null;
          this.debounceResolve = null;
          this.debounceReject = null;
        }
      }, this.debounceMs);
    });
    return this.pendingDebounce;
  }

  public async rebuildNow(): Promise<PromptStructure> {
    // Clear any pending debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    // If there was a pending debounce promise, resolve it with its own build
    if (this.pendingDebounce && this.debounceResolve) {
      // Start the debounced build but don't await it
      this.doBuild(false)
        .then((res) => {
          this.debounceResolve?.(res);
        })
        .catch((e) => {
          this.debounceReject?.(e);
        })
        .finally(() => {
          this.pendingDebounce = null;
          this.debounceResolve = null;
          this.debounceReject = null;
        });
    }

    // Run immediate build (separate from debounced one)
    return this.doBuild(false);
  }

  // Internal

  private async doBuild(
    suppressErrors: boolean = true
  ): Promise<PromptStructure> {
    const root = this.fs.getPromptManagerPath();
    if (!root || !this.fs.fileExists(root)) {
      this.cache = EMPTY;
      return this.cache;
    }

    try {
      const files = await this.walker.scanDirectory(root);
      const structure = await this.organizer.organize(files, root);
      this.cache = structure;
      return structure;
    } catch (e) {
      if (suppressErrors) {
        this.cache = EMPTY;
        return this.cache;
      }
      throw e;
    }
  }
}
