import { PromptStructure } from "./types";
import { log } from "@infra/vscode/log";

export class IndexCache {
  private structure: PromptStructure | null = null;
  private rebuildTimer: NodeJS.Timeout | null = null;

  constructor(private debounceMs = 250) {}

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
   * Mark cache as stale and run the provided callback after an optional
   * debounce. If a subsequent invalidate call is issued before the debounce
   * interval, the timer is reset.
   */
  public invalidate(callback: () => Promise<void>): void {
    this.clear();

    if (this.rebuildTimer) {
      clearTimeout(this.rebuildTimer);
    }

    this.rebuildTimer = setTimeout(async () => {
      try {
        // Keep timer active while callback executes to prevent concurrent rebuilds
        await callback();
      } catch (err) {
        log.error("IndexCache: Rebuild callback failed", err);
      } finally {
        // Only clear timer after callback completes
        this.rebuildTimer = null;
      }
    }, this.debounceMs);
  }

  private clear(): void {
    this.structure = null;
  }
}
