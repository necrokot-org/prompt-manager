import * as vscode from "vscode";
import { injectable, inject } from "tsyringe";
import { Tag } from "../domain/model/Tag";
import { PromptApp } from "./PromptApp";
import { TagPromptFilter } from "./filters/TagPromptFilter";
import { Indexer } from "./ports/Indexer";
import { DI_TOKENS } from "../infrastructure/di/di-tokens";

/**
 * Application service for tag management operations
 */
@injectable()
export class TagApp {
  private readonly _onTagsChanged: vscode.EventEmitter<void> =
    new vscode.EventEmitter<void>();
  public readonly onTagsChanged: vscode.Event<void> = this._onTagsChanged.event;

  private activeTag: Tag | null = null;
  private allTags: Tag[] = [];

  constructor(
    @inject(DI_TOKENS.PromptApp)
    private readonly promptApp: PromptApp,
    @inject(DI_TOKENS.TagPromptFilter)
    private readonly tagFilter: TagPromptFilter,
    @inject(DI_TOKENS.Indexer)
    private readonly indexer: Indexer
  ) {
    // Listen to tree changes to update tag list
    this.promptApp.onTreeChanged(() => {
      this.updateTagsFromStructure();
    });
  }

  async list(): Promise<Tag[]> {
    await this.updateTagsFromStructure();
    return [...this.allTags];
  }

  select(tag: Tag): void {
    this.activeTag = tag;
    this.tagFilter.setActiveTag(tag);
    this._onTagsChanged.fire();
  }

  clear(): void {
    this.activeTag = null;
    this.tagFilter.setActiveTag(null);
    this._onTagsChanged.fire();
  }

  rename(oldTag: Tag, newName: string): void {
    // This would require updating all files that contain the old tag
    // For now, just update our local state
    const newTag = Tag.from(newName);
    const index = this.allTags.findIndex((t) => t.equals(oldTag));
    if (index >= 0) {
      this.allTags[index] = newTag;
      if (this.activeTag?.equals(oldTag)) {
        this.activeTag = newTag;
      }
      this._onTagsChanged.fire();
    }
  }

  remove(tag: Tag): void {
    this.allTags = this.allTags.filter((t) => !t.equals(tag));
    if (this.activeTag?.equals(tag)) {
      this.activeTag = null;
    }
    this._onTagsChanged.fire();
  }

  getActiveTag(): Tag | null {
    return this.activeTag;
  }

  private async updateTagsFromStructure(): Promise<void> {
    // fetch the raw (unfiltered) structure
    const structure = this.indexer.get() ?? (await this.indexer.build());
    const tags = new Set<string>();

    // Collect all tags from prompts
    for (const prompt of structure.rootPrompts) {
      prompt.tags.forEach((tag) => tags.add(tag));
    }

    for (const folder of structure.folders) {
      for (const prompt of folder.prompts) {
        prompt.tags.forEach((tag) => tags.add(tag));
      }
    }

    this.allTags = Array.from(tags)
      .sort()
      .map((tag) => Tag.from(tag));
  }
}
