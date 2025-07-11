import { injectable, inject } from "tsyringe";
import * as vscode from "vscode";
import { Tag } from "@features/prompt-manager/domain/Tag";
import { TagExtractor } from "@features/prompt-manager/domain/TagExtractor";
import { TagUpdater } from "@features/prompt-manager/domain/TagUpdater";
import { TagRepository } from "../repositories/TagRepository";
import { TagFilterState } from "../state/TagFilterState";
import { PromptRepository } from "@features/prompt-manager/domain/promptRepository";
import { FileSystemManager } from "@infra/fs/FileSystemManager";
import { DI_TOKENS } from "@infra/di/di-tokens";
import { eventBus } from "@infra/vscode/ExtensionBus";

/**
 * Application service for tag operations and use cases
 */
@injectable()
export class TagService {
  constructor(
    @inject(DI_TOKENS.TagRepository)
    private tagRepository: TagRepository,
    @inject(DI_TOKENS.TagFilterState)
    private tagFilterState: TagFilterState,
    @inject(DI_TOKENS.TagExtractor)
    private tagExtractor: TagExtractor,
    @inject(DI_TOKENS.TagUpdater)
    private tagUpdater: TagUpdater,
    @inject(DI_TOKENS.PromptRepository)
    private promptRepository: PromptRepository,
    @inject(DI_TOKENS.FileSystemManager)
    private fileSystemManager: FileSystemManager
  ) {}

  /**
   * UC-1: Refresh tags
   */
  public async refreshTags(): Promise<Tag[]> {
    return await this.tagRepository.getAll();
  }

  /**
   * UC-2: Select tag (set as active filter)
   */
  public async selectTag(tag: Tag): Promise<void> {
    await this.tagFilterState.setActiveTag(tag);

    // Set context key for menu visibility
    await vscode.commands.executeCommand(
      "setContext",
      "promptManager.tagFilterActive",
      true
    );

    // Emit events to update both trees
    eventBus.emit("ui.tree.refresh.requested", {
      reason: "tag-filter-changed",
    });
    eventBus.emit("ui.tree.tags.refresh", {
      reason: "tag-filter-changed",
    });
  }

  /**
   * Clear tag selection (remove filter)
   */
  public async clearTagSelection(): Promise<void> {
    await this.tagFilterState.setActiveTag(undefined);

    // Set context key for menu visibility
    await vscode.commands.executeCommand(
      "setContext",
      "promptManager.tagFilterActive",
      false
    );

    // Emit events to update both trees
    eventBus.emit("ui.tree.refresh.requested", {
      reason: "tag-filter-cleared",
    });
    eventBus.emit("ui.tree.tags.refresh", {
      reason: "tag-filter-cleared",
    });
  }

  /**
   * Get the currently active tag filter
   */
  public getActiveTag(): Tag | undefined {
    return this.tagFilterState.getActiveTag();
  }

  /**
   * Extract all prompts from the structure into a flat array
   */
  private async getAllPrompts() {
    const structure = await this.promptRepository.getPromptStructure();
    return [
      ...structure.rootPrompts,
      ...structure.folders.flatMap((f) => f.prompts),
    ];
  }

  /**
   * Force-rebuild the prompt index so UI queries get fresh data.
   * Shows a VS Code warning if the rebuild fails instead of using console.warn.
   */
  private async rebuildIndexSafe(context: string): Promise<void> {
    try {
      await this.promptRepository.getFileManager().rebuildIndex();
    } catch (error: any) {
      vscode.window.showWarningMessage(
        `Prompt index refresh failed after ${context}: ${
          error?.message || error
        }`
      );
    }
  }

  /**
   * UC-3: Rename tag
   */
  public async renameTag(oldTag: Tag, newTagValue: string): Promise<void> {
    const newTag = Tag.from(newTagValue);

    // Find all prompts that have this tag
    const allPrompts = await this.getAllPrompts();

    const affectedPrompts = [];
    for (const prompt of allPrompts) {
      if (await this.tagUpdater.hasTag(oldTag, prompt)) {
        affectedPrompts.push(prompt);
      }
    }

    if (affectedPrompts.length === 0) {
      vscode.window.showInformationMessage(
        `No prompts found with tag "${oldTag.value}"`
      );
      return;
    }

    // Show confirmation dialog
    const fileList = affectedPrompts
      .map((p) => `• ${p.title || p.name} (${p.path})`)
      .join("\n");
    const message = `Rename tag "${oldTag.value}" → "${newTag.value}" in ${affectedPrompts.length} files?`;

    const result = await vscode.window.showWarningMessage(
      message,
      { modal: true, detail: fileList },
      "Rename"
    );

    if (result !== "Rename") {
      return;
    }

    // Apply changes
    const failures: string[] = [];
    for (const prompt of affectedPrompts) {
      try {
        const updatedContent = await this.tagUpdater.rename(
          oldTag,
          newTag,
          prompt
        );
        await this.fileSystemManager.writeFile(prompt.path, updatedContent);
      } catch (error) {
        failures.push(`${prompt.title || prompt.name}: ${error}`);
      }
    }

    // Show results
    if (failures.length === 0) {
      vscode.window.showInformationMessage(
        `Successfully renamed tag "${oldTag.value}" to "${newTag.value}" in ${affectedPrompts.length} files`
      );
    } else {
      vscode.window.showErrorMessage(
        `Renamed tag in ${affectedPrompts.length - failures.length} files, ${
          failures.length
        } failed:\n${failures.join("\n")}`
      );
    }

    // Update active tag filter if the renamed tag was active
    const activeTag = this.getActiveTag();
    if (activeTag && activeTag.equals(oldTag)) {
      await this.tagFilterState.setActiveTag(newTag);
    }

    // Ensure cache is up-to-date before UI refresh
    await this.rebuildIndexSafe("tag rename");

    // Notify repository that tags have changed
    await this.tagRepository.notifyChanged();

    // Emit events to refresh both trees
    eventBus.emit("ui.tree.refresh.requested", {
      reason: "tag-renamed",
    });
    eventBus.emit("ui.tree.tags.refresh", {
      reason: "tag-renamed",
    });
  }

  /**
   * UC-4: Delete tag
   */
  public async deleteTag(tag: Tag): Promise<void> {
    // Find all prompts that have this tag
    const allPrompts = await this.getAllPrompts();

    const affectedPrompts = [];
    for (const prompt of allPrompts) {
      if (await this.tagUpdater.hasTag(tag, prompt)) {
        affectedPrompts.push(prompt);
      }
    }

    if (affectedPrompts.length === 0) {
      vscode.window.showInformationMessage(
        `No prompts found with tag "${tag.value}"`
      );
      return;
    }

    // Show confirmation dialog
    const fileList = affectedPrompts
      .map((p) => `• ${p.title || p.name} (${p.path})`)
      .join("\n");
    const message = `Delete tag "${tag.value}" from ${affectedPrompts.length} files?`;

    const result = await vscode.window.showWarningMessage(
      message,
      { modal: true, detail: fileList },
      "Delete"
    );

    if (result !== "Delete") {
      return;
    }

    // Apply changes
    const failures: string[] = [];
    for (const prompt of affectedPrompts) {
      try {
        const updatedContent = await this.tagUpdater.delete(tag, prompt);
        await this.fileSystemManager.writeFile(prompt.path, updatedContent);
      } catch (error) {
        failures.push(`${prompt.title || prompt.name}: ${error}`);
      }
    }

    // Show results
    if (failures.length === 0) {
      vscode.window.showInformationMessage(
        `Successfully deleted tag "${tag.value}" from ${affectedPrompts.length} files`
      );
    } else {
      vscode.window.showErrorMessage(
        `Deleted tag from ${affectedPrompts.length - failures.length} files, ${
          failures.length
        } failed:\n${failures.join("\n")}`
      );
    }

    // Ensure cache is up-to-date before UI refresh (always needed since files were modified)
    await this.rebuildIndexSafe("tag delete");

    // Notify repository that tags have changed (always needed since files were modified)
    await this.tagRepository.notifyChanged();

    // Clear active tag if it was the deleted tag
    const activeTag = this.getActiveTag();
    if (activeTag && activeTag.equals(tag)) {
      await this.clearTagSelection();
      return; // clearTagSelection already emits refresh events
    }

    // Emit events to refresh both trees
    eventBus.emit("ui.tree.refresh.requested", {
      reason: "tag-deleted",
    });
    eventBus.emit("ui.tree.tags.refresh", {
      reason: "tag-deleted",
    });
  }
}
