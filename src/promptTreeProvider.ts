import * as vscode from "vscode";
import { injectable, inject } from "tsyringe";
import { PromptController } from "./promptController";
import {
  PromptFile,
  PromptFolder,
  ContentSearchResult,
  SearchMatch,
} from "./fileManager";
import { SearchCriteria } from "./searchPanelProvider";
import { SearchService } from "./searchService";
import { ConfigurationService } from "./config";
import { eventBus } from "./core/ExtensionBus";
import { log } from "./core/log";
import { DI_TOKENS } from "./core/di-tokens";
import { FileTreeItem, FolderTreeItem, EmptyStateTreeItem } from "./tree/items";
import { ItemFactory } from "./tree/factory/ItemFactory";
import { SearchFilter } from "./tree/filter/SearchFilter";

// NOTE: The tree item classes (FileTreeItem, FolderTreeItem, EmptyStateTreeItem) have
// been extracted to dedicated modules under `src/tree/items/` to improve
// separation of concerns and unit-testability.

export type PromptTreeItem = FileTreeItem | FolderTreeItem | EmptyStateTreeItem;

@injectable()
export class PromptTreeProvider
  implements vscode.TreeDataProvider<PromptTreeItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    PromptTreeItem | undefined | void
  > = new vscode.EventEmitter<PromptTreeItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<
    PromptTreeItem | undefined | void
  > = this._onDidChangeTreeData.event;

  private _currentSearchCriteria: SearchCriteria | null = null;
  private itemFactory: ItemFactory;
  private searchFilter: SearchFilter;
  private subscriptions: any[] = [];

  constructor(
    @inject(DI_TOKENS.PromptController)
    private promptController: PromptController,
    @inject(DI_TOKENS.SearchService) searchService: SearchService,
    @inject(DI_TOKENS.ConfigurationService)
    private configurationService: ConfigurationService
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

    if (!folder || !folder.prompts) {
      log.warn("getFolderItems: Invalid folder provided:", folder);
      return items;
    }

    for (const prompt of folder.prompts) {
      if (prompt && prompt.title) {
        const promptItem = this.createFileTreeItem(prompt, {
          command: "promptManager.openPrompt",
          title: "Open Prompt",
          arguments: [prompt.path],
        });
        items.push(promptItem);
      } else {
        log.warn("getFolderItems: Skipping invalid prompt:", prompt);
      }
    }

    // If folder is empty, show empty state
    if (items.length === 0) {
      const emptyItem = this.itemFactory.createEmptyStateItem(
        "No prompts in this folder",
        "Right-click folder to add prompts",
        "emptyFolder"
      );
      items.push(emptyItem);
    }

    return items;
  }

  // Helper method to get tree item by path (useful for commands)
  public async findTreeItemByPath(
    filePath: string
  ): Promise<FileTreeItem | undefined> {
    const structure = await this.promptController.getPromptStructure();

    // Check root prompts
    for (const prompt of structure.rootPrompts) {
      if (prompt.path === filePath) {
        return this.createFileTreeItem(prompt);
      }
    }

    // Check folder prompts
    for (const folder of structure.folders) {
      for (const prompt of folder.prompts) {
        if (prompt.path === filePath) {
          return this.createFileTreeItem(prompt);
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

  /**
   * Dispose of resources and event subscriptions
   */
  private createFileTreeItem(
    promptFile: PromptFile,
    command?: vscode.Command
  ): FileTreeItem {
    return this.itemFactory.createFileTreeItem(promptFile, command);
  }

  public dispose(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.subscriptions = [];
    this._onDidChangeTreeData.dispose();
  }
}
