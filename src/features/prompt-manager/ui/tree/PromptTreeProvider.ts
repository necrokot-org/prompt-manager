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
} from "@features/prompt-manager/ui/tree/items";
import { ItemFactory } from "@features/prompt-manager/ui/tree/factory/ItemFactory";
import { SearchFilter } from "@features/prompt-manager/ui/tree/filter/SearchFilter";
import { FileSystemManager } from "@infra/fs/FileSystemManager";

// NOTE: The tree item classes (FileTreeItem, FolderTreeItem, EmptyStateTreeItem) have
// been extracted to dedicated modules under `src/tree/items/` to improve
// separation of concerns and unit-testability.

export type PromptTreeItem = FileTreeItem | FolderTreeItem | EmptyStateTreeItem;

// Simple state for drag operations
let currentDrag: vscode.Uri | undefined;

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
  private searchFilter: SearchFilter;
  private subscriptions: any[] = [];

  constructor(
    @inject(DI_TOKENS.PromptController)
    private promptController: PromptController,
    @inject(DI_TOKENS.SearchService) searchService: SearchService,
    @inject(DI_TOKENS.ConfigurationService)
    private configurationService: ConfigurationService,
    @inject(DI_TOKENS.FileSystemManager)
    private fileSystemManager: FileSystemManager
  ) {
    // Initialize modular helpers
    this.itemFactory = new ItemFactory(this.configurationService);
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
      // Root level - return folders and root prompts
      return this.getRootItems();
    }

    if (element instanceof FolderTreeItem) {
      // Return prompts in this folder
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

      // If search is active, apply filtering
      if (this._currentSearchCriteria?.isActive) {
        log.debug("getRootItems: Search is active, getting filtered items");
        return this.getFilteredItems(structure);
      }

      // Add folders
      if (structure?.folders) {
        log.debug("getRootItems: Processing folders");
        for (const folder of structure.folders) {
          log.debug("getRootItems: Processing folder:", folder);
          if (folder && folder.name) {
            const folderItem = this.itemFactory.createFolderTreeItem(folder);
            items.push(folderItem);
            log.debug("getRootItems: Added folder item:", folder.name);
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
      if (items.length === 0) {
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
        new EmptyStateTreeItem(
          "Error loading prompts",
          "Check console for details",
          "error"
        ),
      ];
    }
  }

  private getFolderItems(folder: PromptFolder): PromptTreeItem[] {
    const items: PromptTreeItem[] = [];

    if (!folder.prompts || folder.prompts.length === 0) {
      return items;
    }

    for (const prompt of folder.prompts) {
      const promptItem = this.createFileTreeItem(prompt, {
        command: "promptManager.openPrompt",
        title: "Open Prompt",
        arguments: [prompt.path],
      });
      items.push(promptItem);
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
    dataTransfer: vscode.DataTransfer,
    token: vscode.CancellationToken
  ): Promise<void> {
    // Only support dragging single file items
    if (source.length !== 1 || !(source[0] instanceof FileTreeItem)) {
      return;
    }

    const item = source[0] as FileTreeItem;
    currentDrag = vscode.Uri.file(item.promptFile.path);

    // Set drag data
    dataTransfer.set(
      this.dragMimeTypes[0],
      new vscode.DataTransferItem(item.promptFile.path)
    );
  }

  async handleDrop(
    target: PromptTreeItem | undefined,
    dataTransfer: vscode.DataTransfer,
    token: vscode.CancellationToken
  ): Promise<void> {
    // Get source path from drag data
    const dragDataItem = dataTransfer.get(this.dragMimeTypes[0]);
    if (!dragDataItem || !currentDrag) {
      return;
    }

    const source = currentDrag;

    // Calculate target URI
    let targetUri: vscode.Uri;
    const fileName = path.basename(source.fsPath);

    if (target instanceof FolderTreeItem) {
      // Dropping on folder
      targetUri = vscode.Uri.file(
        path.join(target.promptFolder.path, fileName)
      );
    } else if (target instanceof FileTreeItem) {
      // Dropping on file - use parent folder
      targetUri = vscode.Uri.file(
        path.join(path.dirname(target.promptFile.path), fileName)
      );
    } else {
      // Dropping on root
      const rootPath = this.fileSystemManager.getPromptManagerPath();
      if (!rootPath) {
        log.error("handleDrop: No root path found");
        return;
      }
      targetUri = vscode.Uri.file(path.join(rootPath, fileName));
    }

    if (source.fsPath === targetUri.fsPath) {
      return;
    }

    if (
      source.fsPath === targetUri.fsPath ||
      (await fsExtra.pathExists(targetUri.fsPath))
    ) {
      vscode.window.showErrorMessage("Move not allowed");
      return;
    }

    try {
      // Execute move immediately
      await this.fileSystemManager.moveFile(source.fsPath, targetUri.fsPath);

      // Refresh tree
      await this.promptController.refresh();

      // Simple success feedback
      vscode.window.showInformationMessage(`Moved "${fileName}"`);
    } catch (error) {
      // Simple failure feedback
      vscode.window.showErrorMessage("Move not allowed");
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
