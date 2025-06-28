import { PromptStructure } from "./types";
import { log } from "@infra/vscode/log";

export class IndexCache {
  private structure: PromptStructure | null = null;
  private activePromise: Promise<void> | null = null;
  private activeResolve: (() => void) | null = null;
  private activeTimer: NodeJS.Timeout | null = null;

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

  private clear(): void {
    this.structure = null;
  }
}
