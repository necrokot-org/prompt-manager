import * as vscode from "vscode";
import * as path from "path";
import * as fsExtra from "fs-extra";
import { injectable, inject } from "tsyringe";
import { PromptController } from "@features/prompt-manager/domain/promptController";
import {
  PromptFile,
  PromptFolder,
  ContentSearchResult,
  SearchMatch,
} from "@features/prompt-manager/data/fileManager";
import { SearchCriteria } from "@features/search/ui/SearchPanelProvider";
import { SearchService } from "@features/search/services/searchService";
import { ConfigurationService } from "@infra/config/config";
import { eventBus } from "@infra/vscode/ExtensionBus";
import { log } from "@infra/vscode/log";
import { DI_TOKENS } from "@infra/di/di-tokens";
import {
  FileTreeItem,
  FolderTreeItem,
  EmptyStateTreeItem,
  TagRootTreeItem,
  TagTreeItem,
} from "@features/prompt-manager/ui/tree/items";
import { ItemFactory } from "@features/prompt-manager/ui/tree/factory/ItemFactory";
import { TagItemFactory } from "@features/prompt-manager/ui/tree/factory/TagItemFactory";
import { SearchFilter } from "@features/prompt-manager/ui/tree/filter/SearchFilter";
import { FileSystemManager } from "@infra/fs/FileSystemManager";
import { TagService } from "@features/prompt-manager/application/services/TagService";
import { Tag } from "@features/prompt-manager/domain/Tag";

// NOTE: The tree item classes (FileTreeItem, FolderTreeItem, EmptyStateTreeItem) have
// been extracted to dedicated modules under `src/tree/items/` to improve
// separation of concerns and unit-testability.

export type PromptTreeItem =
  | FileTreeItem
  | FolderTreeItem
  | EmptyStateTreeItem
  | TagRootTreeItem
  | TagTreeItem;

// Simple state for drag operations
let currentDrag: { uri: vscode.Uri; type: "file" | "folder" } | undefined;

@injectable()
export class PromptTreeProvider
  implements
    vscode.TreeDataProvider<PromptTreeItem>,
    vscode.TreeDragAndDropController<PromptTreeItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    PromptTreeItem | undefined | void
  > = new vscode.EventEmitter<PromptTreeItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<
    PromptTreeItem | undefined | void
  > = this._onDidChangeTreeData.event;

  // TreeDragAndDropController properties
  dropMimeTypes = ["application/vnd.code.tree.promptmanager"];
  dragMimeTypes = ["application/vnd.code.tree.promptmanager"];

  private _currentSearchCriteria: SearchCriteria | null = null;
  private itemFactory: ItemFactory;
  private tagItemFactory: TagItemFactory;
  private searchFilter: SearchFilter;
  private subscriptions: any[] = [];

  constructor(
    @inject(DI_TOKENS.PromptController)
    private promptController: PromptController,
    @inject(DI_TOKENS.SearchService) searchService: SearchService,
    @inject(DI_TOKENS.ConfigurationService)
    private configurationService: ConfigurationService,
    @inject(DI_TOKENS.FileSystemManager)
    private fileSystemManager: FileSystemManager,
    @inject(DI_TOKENS.TagService)
    private tagService: TagService
  ) {
    // Initialize modular helpers
    this.itemFactory = new ItemFactory(this.configurationService);
    this.tagItemFactory = new TagItemFactory();
    this.searchFilter = new SearchFilter(searchService);

    // Listen to tree refresh events
    this.subscriptions.push(
      eventBus.on("ui.tree.refresh.requested", () => {
        this.refresh();
      })
    );

    // Listen to search criteria changes
    this.subscriptions.push(
      eventBus.on("search.criteria.changed", (payload) => {
        const { query, scope, caseSensitive, isActive } = payload;
        this.setSearchCriteria(
          isActive ? { query, scope, caseSensitive, isActive } : null
        );
      })
    );

    this.subscriptions.push(
      eventBus.on("search.cleared", () => {
        this.setSearchCriteria(null);
      })
    );
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  public setSearchCriteria(criteria: SearchCriteria | null): void {
    this._currentSearchCriteria = criteria;
    this.refresh();
  }

  public getCurrentSearchCriteria(): SearchCriteria | null {
    return this._currentSearchCriteria;
  }

  getTreeItem(element: PromptTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: PromptTreeItem): Promise<PromptTreeItem[]> {
    if (!element) {
      // Root level - return tags root and files root
      return this.getRootItems();
    }

    if (element instanceof TagRootTreeItem) {
      // Return all available tags
      return this.getTagItems();
    }

    if (element instanceof FolderTreeItem) {
      // Return prompts and subfolders in this folder
      return this.getFolderItems(element.promptFolder);
    }

    return [];
  }

  private async getRootItems(): Promise<PromptTreeItem[]> {
    try {
      log.debug("getRootItems: Starting to get prompt structure");
      const structure = await this.promptController.getPromptStructure();
      log.debug("getRootItems: Got structure", {
        foldersCount: structure?.folders?.length || 0,
        rootPromptsCount: structure?.rootPrompts?.length || 0,
        structure,
      });

      const items: PromptTreeItem[] = [];

      // Check if tag filter is active for TagRoot display
      const activeTag = this.tagService.getActiveTag();
      const hasActiveFilter = activeTag !== undefined;

      // Always show the Tags root first with active filter info
      items.push(
        this.tagItemFactory.createTagRootItem(hasActiveFilter, activeTag?.value)
      );

      // If search is active, apply filtering to remaining items
      if (this._currentSearchCriteria?.isActive) {
        log.debug("getRootItems: Search is active, getting filtered items");
        const filteredItems = await this.getFilteredItems(structure);
        items.push(...filteredItems);
        return items;
      }

      // Check if tag filter is active
      if (activeTag) {
        log.debug("getRootItems: Tag filter is active, filtering by tag");
        const tagFilteredItems = await this.getTagFilteredItems(
          structure,
          activeTag
        );
        items.push(...tagFilteredItems);
        return items;
      }

      // Add folders that are in the root (no parent folders)
      if (structure?.folders) {
        log.debug("getRootItems: Processing folders");
        const basePromptPath = this.promptController
          .getRepository()
          .getFileManager()
          .getPromptManagerPath();

        for (const folder of structure.folders) {
          log.debug("getRootItems: Processing folder:", folder);
          if (folder && folder.name) {
            // Only show folders whose parent is the root prompt manager directory
            const parentPath = path.dirname(folder.path);
            if (parentPath === basePromptPath) {
              const folderItem = this.itemFactory.createFolderTreeItem(folder);
              items.push(folderItem);
              log.debug("getRootItems: Added root folder item:", folder.name);
            }
          } else {
            log.warn("FolderTreeItem: Skipping invalid folder:", folder);
          }
        }
      }

      // Add root prompts
      if (structure?.rootPrompts) {
        log.debug("getRootItems: Processing root prompts");
        for (const prompt of structure.rootPrompts) {
          log.debug("getRootItems: Processing prompt:", prompt);
          if (prompt && prompt.title) {
            const promptItem = this.createFileTreeItem(prompt, {
              command: "promptManager.openPrompt",
              title: "Open Prompt",
              arguments: [prompt.path],
            });
            items.push(promptItem);
            log.debug("getRootItems: Added prompt item:", prompt.title);
          } else {
            log.warn("FileTreeItem: Skipping invalid prompt:", prompt);
          }
        }
      }

      // If no items, show empty state message
      if (items.length === 1) {
        // Only TagRoot exists
        log.debug("getRootItems: No items found, showing empty state");
        items.push(
          this.itemFactory.createEmptyStateItem(
            "No prompts yet",
            "Click + to add your first prompt",
            "emptyState"
          )
        );
      }

      log.debug("getRootItems: Returning items", { count: items.length });
      return items;
    } catch (error) {
      log.error("Error in getRootItems:", error);
      vscode.window.showErrorMessage(`Error getting root items: ${error}`);
      return [
        this.tagItemFactory.createTagRootItem(),
        new EmptyStateTreeItem(
          "Error loading prompts",
          "Check console for details",
          "error"
        ),
      ];
    }
  }

  /**
   * Get all tag items for the tag root
   */
  private async getTagItems(): Promise<PromptTreeItem[]> {
    try {
      const tags = await this.tagService.refreshTags();
      const activeTag = this.tagService.getActiveTag();

      if (tags.length === 0) {
        return [
          this.itemFactory.createEmptyStateItem(
            "No tags found",
            "Add tags to your prompts to see them here",
            "emptyTags"
          ),
        ];
      }

      // Calculate prompt counts for each tag
      const promptCounts = await this.calculatePromptCounts(tags);

      return this.tagItemFactory.createTagItems(tags, activeTag, promptCounts);
    } catch (error) {
      log.error("getTagItems: Error getting tags:", error);
      return [
        this.itemFactory.createEmptyStateItem(
          "Error loading tags",
          "Check the logs for details",
          "error"
        ),
      ];
    }
  }

  /**
   * Calculate how many prompts have each tag
   */
  private async calculatePromptCounts(
    tags: Tag[]
  ): Promise<Map<string, number>> {
    const counts = new Map<string, number>();

    try {
      const structure = await this.promptController.getPromptStructure();
      const allPrompts = [
        ...structure.rootPrompts,
        ...structure.folders.flatMap((f: any) => f.prompts),
      ];

      // Initialize counts
      tags.forEach((tag) => counts.set(tag.value, 0));

      // Count prompts for each tag
      for (const prompt of allPrompts) {
        if (prompt.tags && Array.isArray(prompt.tags)) {
          prompt.tags.forEach((tagValue: string) => {
            if (counts.has(tagValue)) {
              counts.set(tagValue, counts.get(tagValue)! + 1);
            }
          });
        }
      }
    } catch (error) {
      log.error(
        "calculatePromptCounts: Error calculating prompt counts:",
        error
      );
      // Return empty counts in case of error
    }

    return counts;
  }

  /**
   * Get items filtered by a specific tag
   */
  private async getTagFilteredItems(
    structure: any,
    activeTag: any
  ): Promise<PromptTreeItem[]> {
    try {
      const items: PromptTreeItem[] = [];
      const allPrompts = [
        ...structure.rootPrompts,
        ...structure.folders.flatMap((f: any) => f.prompts),
      ];

      // Filter prompts that have the active tag
      for (const prompt of allPrompts) {
        if (prompt.tags && prompt.tags.includes(activeTag.value)) {
          const promptItem = this.createFileTreeItem(prompt, {
            command: "promptManager.openPrompt",
            title: "Open Prompt",
            arguments: [prompt.path],
          });
          items.push(promptItem);
        }
      }

      if (items.length === 0) {
        items.push(
          this.itemFactory.createEmptyStateItem(
            `No prompts with tag "${activeTag.value}"`,
            "Click on Tags to browse all tags",
            "emptyTagFilter"
          )
        );
      }

      return items;
    } catch (error) {
      log.error("getTagFilteredItems: Error filtering by tag:", error);
      return [
        this.itemFactory.createEmptyStateItem(
          "Error filtering by tag",
          "Check the logs for details",
          "error"
        ),
      ];
    }
  }

  private async getFolderItems(
    folder: PromptFolder
  ): Promise<PromptTreeItem[]> {
    const items: PromptTreeItem[] = [];
    const structure = await this.promptController.getPromptStructure();

    // Add child folders (folders whose parent path equals this folder's path)
    if (structure?.folders) {
      for (const childFolder of structure.folders) {
        const childParentPath = path.dirname(childFolder.path);
        if (childParentPath === folder.path) {
          const folderItem = this.itemFactory.createFolderTreeItem(childFolder);
          items.push(folderItem);
        }
      }
    }

    // Add prompts directly in this folder
    if (folder.prompts && folder.prompts.length > 0) {
      for (const prompt of folder.prompts) {
        const promptItem = this.createFileTreeItem(prompt, {
          command: "promptManager.openPrompt",
          title: "Open Prompt",
          arguments: [prompt.path],
        });
        items.push(promptItem);
      }
    }

    return items;
  }

  public async findTreeItemByPath(
    filePath: string
  ): Promise<FileTreeItem | undefined> {
    const structure = await this.promptController.getPromptStructure();

    // Search in root prompts
    if (structure?.rootPrompts) {
      for (const prompt of structure.rootPrompts) {
        if (prompt.path === filePath) {
          return this.createFileTreeItem(prompt);
        }
      }
    }

    // Search in folder prompts
    if (structure?.folders) {
      for (const folder of structure.folders) {
        if (folder.prompts) {
          for (const prompt of folder.prompts) {
            if (prompt.path === filePath) {
              return this.createFileTreeItem(prompt);
            }
          }
        }
      }
    }

    return undefined;
  }

  private async getFilteredItems(structure: any): Promise<PromptTreeItem[]> {
    const items: PromptTreeItem[] = [];
    const criteria = this._currentSearchCriteria!;
    let totalMatches = 0;

    // Check if structure is valid
    if (!structure) {
      log.warn("getFilteredItems: Invalid structure provided");
      return items;
    }

    // Search through root prompts
    if (structure.rootPrompts) {
      for (const prompt of structure.rootPrompts) {
        if (
          prompt &&
          prompt.title &&
          (await this.matchesSearchCriteria(prompt, criteria))
        ) {
          const promptItem = this.createFileTreeItem(prompt, {
            command: "promptManager.openPrompt",
            title: "Open Prompt",
            arguments: [prompt.path],
          });
          items.push(promptItem);
          totalMatches++;
        }
      }
    }

    // Search through folders and their prompts
    if (structure.folders) {
      for (const folder of structure.folders) {
        if (!folder || !folder.name) {
          log.warn("getFilteredItems: Skipping invalid folder:", folder);
          continue;
        }

        const matchingPrompts: PromptFile[] = [];

        if (folder.prompts) {
          for (const prompt of folder.prompts) {
            if (
              prompt &&
              prompt.title &&
              (await this.matchesSearchCriteria(prompt, criteria))
            ) {
              matchingPrompts.push(prompt);
              totalMatches++;
            }
          }
        }

        // If folder has matching prompts, include the folder with just those prompts
        if (matchingPrompts.length > 0) {
          const filteredFolder: PromptFolder = {
            ...folder,
            name: `${folder.name} (${matchingPrompts.length})`,
            prompts: matchingPrompts,
          };
          const folderItem =
            this.itemFactory.createFolderTreeItem(filteredFolder);
          items.push(folderItem);
        }
      }
    }

    // If no matches, show no results message
    if (items.length === 0) {
      const noResultsItem = this.itemFactory.createEmptyStateItem(
        "No matching prompts",
        `No prompts match "${criteria.query}"`,
        "noResults",
        new vscode.ThemeIcon("search")
      );
      items.push(noResultsItem);
    }

    return items;
  }

  private async matchesSearchCriteria(
    prompt: PromptFile,
    criteria: SearchCriteria
  ): Promise<boolean> {
    return await this.searchFilter.matches(prompt, criteria);
  }

  private createFileTreeItem(
    promptFile: PromptFile,
    command?: vscode.Command
  ): FileTreeItem {
    return this.itemFactory.createFileTreeItem(promptFile, command);
  }

  // Simplified TreeDragAndDropController implementation
  async handleDrag(
    source: readonly PromptTreeItem[],
    dataTransfer: vscode.DataTransfer
  ): Promise<void> {
    // Only support dragging single items (files or folders)
    if (source.length !== 1) {
      return;
    }

    const item = source[0];

    if (item instanceof FileTreeItem) {
      currentDrag = {
        uri: vscode.Uri.file(item.promptFile.path),
        type: "file",
      };

      // Set drag data
      dataTransfer.set(
        this.dragMimeTypes[0],
        new vscode.DataTransferItem(
          JSON.stringify({
            path: item.promptFile.path,
            type: "file",
          })
        )
      );
    } else if (item instanceof FolderTreeItem) {
      currentDrag = {
        uri: vscode.Uri.file(item.promptFolder.path),
        type: "folder",
      };

      // Set drag data
      dataTransfer.set(
        this.dragMimeTypes[0],
        new vscode.DataTransferItem(
          JSON.stringify({
            path: item.promptFolder.path,
            type: "folder",
          })
        )
      );
    } else {
      return;
    }
  }

  async handleDrop(
    target: PromptTreeItem | undefined,
    dataTransfer: vscode.DataTransfer
  ): Promise<void> {
    // Get source path from drag data
    const dragDataItem = dataTransfer.get(this.dragMimeTypes[0]);
    if (!dragDataItem || !currentDrag) {
      return;
    }

    let dragData;
    try {
      dragData = JSON.parse(dragDataItem.value as string);
    } catch (error) {
      log.error("handleDrop: Failed to parse drag data", error);
      return;
    }

    const source = currentDrag.uri;
    const sourceType = currentDrag.type;

    // Calculate target URI
    let targetUri: vscode.Uri;
    const itemName = path.basename(source.fsPath);

    if (target instanceof FolderTreeItem) {
      // Dropping on folder
      targetUri = vscode.Uri.file(
        path.join(target.promptFolder.path, itemName)
      );
    } else if (target instanceof FileTreeItem) {
      // Dropping on file - use parent folder
      targetUri = vscode.Uri.file(
        path.join(path.dirname(target.promptFile.path), itemName)
      );
    } else {
      // Dropping on root
      const rootPath = this.fileSystemManager.getPromptManagerPath();
      if (!rootPath) {
        log.error("handleDrop: No root path found");
        return;
      }
      targetUri = vscode.Uri.file(path.join(rootPath, itemName));
    }

    // Don't allow dropping on itself
    if (source.fsPath === targetUri.fsPath) {
      return;
    }

    // Don't allow dropping into a child of itself (for folders)
    if (
      sourceType === "folder" &&
      targetUri.fsPath.startsWith(source.fsPath + path.sep)
    ) {
      vscode.window.showErrorMessage(
        "Cannot move folder into itself or its subdirectory"
      );
      return;
    }

    // Check if target already exists
    if (await fsExtra.pathExists(targetUri.fsPath)) {
      vscode.window.showErrorMessage(
        "Move not allowed - target already exists"
      );
      return;
    }

    try {
      // Execute move based on source type
      if (sourceType === "file") {
        await this.fileSystemManager.moveFile(source.fsPath, targetUri.fsPath);
        vscode.window.showInformationMessage(`Moved file "${itemName}"`);
        // For files, immediate refresh is sufficient
        await this.promptController.refresh();
      } else if (sourceType === "folder") {
        await this.fileSystemManager.moveFolder(
          source.fsPath,
          targetUri.fsPath
        );
        vscode.window.showInformationMessage(`Moved folder "${itemName}"`);

        // For folder moves, we need to explicitly invalidate cache and force a rebuild
        const fileManager = this.promptController
          .getRepository()
          .getFileManager();
        fileManager.clearContentCache();

        // Small delay to ensure file system operations are complete, then force rebuild
        setTimeout(async () => {
          try {
            await fileManager.rebuildIndexForce();
            this.refresh();
          } catch (error) {
            log.error("Failed to rebuild index after folder move:", error);
            // Fallback to regular refresh
            this.refresh();
          }
        }, 150);
      }
    } catch (error) {
      log.error("handleDrop: Move operation failed", error);
      vscode.window.showErrorMessage(`Failed to move ${sourceType}: ${error}`);
    } finally {
      // Clear drag state
      currentDrag = undefined;
    }
  }

  public dispose(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.subscriptions = [];
    this._onDidChangeTreeData.dispose();
  }
}
