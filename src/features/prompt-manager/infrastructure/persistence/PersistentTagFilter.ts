import { injectable, inject } from "tsyringe";
import * as vscode from "vscode";
import { Tag } from "@features/prompt-manager/domain/Tag";
import { TagFilterState } from "@features/prompt-manager/application/state/TagFilterState";
import { DI_TOKENS } from "@infra/di/di-tokens";

/**
 * Implementation of TagFilterState using VS Code workspace state
 */
@injectable()
export class PersistentTagFilter implements TagFilterState {
  private static readonly ACTIVE_TAG_KEY = "promptManager.activeTag";
  private activeTag: Tag | undefined;

  constructor(
    @inject(DI_TOKENS.ExtensionContext)
    private context: vscode.ExtensionContext
  ) {
    // Load active tag from workspace state on initialization
    this.loadActiveTag();
  }

  /**
   * Get the currently active tag filter
   */
  public getActiveTag(): Tag | undefined {
    return this.activeTag;
  }

  /**
   * Set the active tag filter (undefined to clear)
   */
  public async setActiveTag(tag: Tag | undefined): Promise<void> {
    this.activeTag = tag;

    // Persist to workspace state
    await this.context.workspaceState.update(
      PersistentTagFilter.ACTIVE_TAG_KEY,
      tag ? tag.value : undefined
    );
  }

  /**
   * Load active tag from workspace state
   */
  private loadActiveTag(): void {
    const savedTagValue = this.context.workspaceState.get<string>(
      PersistentTagFilter.ACTIVE_TAG_KEY
    );

    if (savedTagValue) {
      try {
        this.activeTag = Tag.from(savedTagValue);
      } catch (error) {
        // Clear invalid saved tag
        this.context.workspaceState.update(
          PersistentTagFilter.ACTIVE_TAG_KEY,
          undefined
        );
        this.activeTag = undefined;
      }
    }
  }
}
