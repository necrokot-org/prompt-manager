import * as vscode from "vscode";
import { injectable, inject } from "tsyringe";
import { TagService } from "@features/prompt-manager/application/services/TagService";
import { TagItemFactory } from "@features/prompt-manager/ui/tree/factory/TagItemFactory";
import {
  TagRootTreeItem,
  TagTreeItem,
} from "@features/prompt-manager/ui/tree/items";
import { Tag } from "@features/prompt-manager/domain/Tag";
import { eventBus } from "@infra/vscode/ExtensionBus";
import { log } from "@infra/vscode/log";
import { DI_TOKENS } from "@infra/di/di-tokens";
import { PromptRepository } from "@features/prompt-manager/domain/promptRepository";

/**
 * Tree provider for displaying tags in a dedicated Tags tree view
 */
@injectable()
export class TagTreeProvider
  implements vscode.TreeDataProvider<TagRootTreeItem | TagTreeItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    TagRootTreeItem | TagTreeItem | undefined | void
  > = new vscode.EventEmitter<
    TagRootTreeItem | TagTreeItem | undefined | void
  >();
  readonly onDidChangeTreeData: vscode.Event<
    TagRootTreeItem | TagTreeItem | undefined | void
  > = this._onDidChangeTreeData.event;

  private tagItemFactory: TagItemFactory;
  private subscriptions: any[] = [];

  constructor(
    @inject(DI_TOKENS.TagService)
    private tagService: TagService,
    @inject(DI_TOKENS.PromptRepository)
    private promptRepository: PromptRepository
  ) {
    this.tagItemFactory = new TagItemFactory();

    // Listen to tag-specific operations (select, clear, rename, delete)
    this.subscriptions.push(
      eventBus.on("ui.tree.tags.refresh", (payload) => {
        log.debug("TagTreeProvider: Refreshing due to tag operation", payload);
        this.refresh();
      })
    );

    // Listen to filesystem events since tags come from file content
    this.subscriptions.push(
      eventBus.on("filesystem.file.created", (payload) => {
        log.debug("TagTreeProvider: File created, refreshing tags", payload);
        this.refresh();
      })
    );

    this.subscriptions.push(
      eventBus.on("filesystem.file.changed", (payload) => {
        log.debug("TagTreeProvider: File changed, refreshing tags", payload);
        this.refresh();
      })
    );

    this.subscriptions.push(
      eventBus.on("filesystem.resource.deleted", (payload) => {
        log.debug(
          "TagTreeProvider: Resource deleted, refreshing tags",
          payload
        );
        this.refresh();
      })
    );
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TagRootTreeItem | TagTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(
    element?: TagRootTreeItem | TagTreeItem
  ): Promise<(TagRootTreeItem | TagTreeItem)[]> {
    if (!element) {
      // Root level - return tags root
      return this.getRootItems();
    }

    if (element instanceof TagRootTreeItem) {
      // Return all available tags
      return this.getTagItems();
    }

    return [];
  }

  private async getRootItems(): Promise<TagRootTreeItem[]> {
    try {
      // Check if tag filter is active for TagRoot display
      const activeTag = this.tagService.getActiveTag();
      const hasActiveFilter = activeTag !== undefined;

      return [
        this.tagItemFactory.createTagRootItem(
          hasActiveFilter,
          activeTag?.value
        ),
      ];
    } catch (error) {
      log.error("TagTreeProvider: Failed to get root items", error);
      return [];
    }
  }

  private async getTagItems(): Promise<TagTreeItem[]> {
    try {
      const tags = await this.tagService.refreshTags();
      const activeTag = this.tagService.getActiveTag();

      // Calculate prompt counts for each tag
      const promptCounts = await this.calculatePromptCounts(tags);

      return tags.map((tag) => {
        const isActive = activeTag?.equals(tag) || false;
        const promptCount = promptCounts.get(tag.value) || 0;
        return this.tagItemFactory.createTagItem(tag, isActive, promptCount);
      });
    } catch (error) {
      log.error("TagTreeProvider: Failed to get tag items", error);
      return [];
    }
  }

  private async calculatePromptCounts(
    tags: Tag[]
  ): Promise<Map<string, number>> {
    const counts = new Map<string, number>();

    try {
      const structure = await this.promptRepository.getPromptStructure();
      const allPrompts = [
        ...structure.rootPrompts,
        ...structure.folders.flatMap((f) => f.prompts),
      ];

      for (const tag of tags) {
        let count = 0;
        for (const prompt of allPrompts) {
          if (
            prompt.tags &&
            prompt.tags.some((tagValue) => Tag.from(tagValue).equals(tag))
          ) {
            count++;
          }
        }
        counts.set(tag.value, count);
      }
    } catch (error) {
      log.error("TagTreeProvider: Failed to calculate prompt counts", error);
    }

    return counts;
  }

  public dispose(): void {
    this.subscriptions.forEach((sub) => {
      if (typeof sub.dispose === "function") {
        sub.dispose();
      }
    });
  }
}
