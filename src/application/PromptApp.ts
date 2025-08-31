import * as vscode from "vscode";
import { injectable, inject } from "tsyringe";
import { PromptStore } from "./ports/PromptStore";
import { Indexer } from "./ports/Indexer";
import { FilterCoordinator } from "./filters/FilterCoordinator";
import { PromptStructure } from "../domain/model/PromptStructure";
import { DI_TOKENS } from "../infrastructure/di/di-tokens";

/**
 * Application service for prompt management operations
 */
@injectable()
export class PromptApp {
  private readonly _onTreeChanged: vscode.EventEmitter<void> =
    new vscode.EventEmitter<void>();
  public readonly onTreeChanged: vscode.Event<void> = this._onTreeChanged.event;

  constructor(
    @inject(DI_TOKENS.PromptStore)
    private readonly store: PromptStore,
    @inject(DI_TOKENS.Indexer)
    private readonly indexer: Indexer,
    @inject(DI_TOKENS.FilterCoordinator)
    private readonly filters: FilterCoordinator
  ) {}

  async initWorkspace(): Promise<void> {
    // Ensure workspace is initialized and indexed
    await this.indexer.build();
  }

  async structure(): Promise<PromptStructure> {
    const s = this.indexer.get() ?? (await this.indexer.build());
    return await this.filters.apply(s);
  }

  async createPrompt(name: string, folder?: string): Promise<string> {
    const path = await this.store.createPrompt(name, folder);
    await this.indexer.rebuild();
    this._onTreeChanged.fire();
    return path;
  }

  async deletePrompt(path: string): Promise<void> {
    await this.store.deletePrompt(path);
    await this.indexer.rebuild();
    this._onTreeChanged.fire();
  }

  async createFolder(name: string, parent?: string): Promise<string> {
    const path = await this.store.createFolder(name, parent);
    await this.indexer.rebuild();
    this._onTreeChanged.fire();
    return path;
  }

  async deleteFolder(path: string): Promise<void> {
    await this.store.deleteFolder(path);
    await this.indexer.rebuild();
    this._onTreeChanged.fire();
  }

  async open(path: string): Promise<void> {
    // This would typically open the file in VS Code
    // For now, we'll just return the content
    await this.store.read(path);
  }

  async copyContent(path: string, withMeta: boolean = false): Promise<string> {
    const content = await this.store.read(path);
    if (!withMeta) {
      // Extract just the body content (after frontmatter)
      const lines = content.split("\n");
      let inFrontmatter = false;
      let bodyStart = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim() === "---") {
          if (!inFrontmatter) {
            inFrontmatter = true;
          } else {
            bodyStart = i + 1;
            break;
          }
        }
      }

      return lines.slice(bodyStart).join("\n").trim();
    }
    return content;
  }
}
