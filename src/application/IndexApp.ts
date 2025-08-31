import * as vscode from "vscode";
import { injectable, inject } from "tsyringe";
import { Indexer } from "./ports/Indexer";
import { DI_TOKENS } from "../infrastructure/di/di-tokens";

/**
 * Application service for indexing operations
 */
@injectable()
export class IndexApp {
  private readonly _onTreeChanged: vscode.EventEmitter<void> =
    new vscode.EventEmitter<void>();
  public readonly onTreeChanged: vscode.Event<void> = this._onTreeChanged.event;

  constructor(
    @inject(DI_TOKENS.Indexer)
    private readonly indexer: Indexer
  ) {}

  async rebuild(debounced: boolean = true): Promise<void> {
    try {
      if (debounced) {
        await this.indexer.rebuild();
      } else {
        await this.indexer.rebuildNow();
      }
      this._onTreeChanged.fire();
    } catch (error) {
      console.error("Failed to rebuild index:", error);
    }
  }

  async rebuildNow(): Promise<void> {
    return this.rebuild(false);
  }
}
