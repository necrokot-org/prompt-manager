import * as vscode from "vscode";
import { PromptManager } from "./promptManager";
import {
  PromptFile,
  PromptFolder,
  ContentSearchResult,
  SearchMatch,
} from "./fileManager";
import { SearchCriteria } from "./searchPanelProvider";
import { SearchService } from "./searchService";

export abstract class BaseTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    command?: vscode.Command
  ) {
    super(label, collapsibleState);
    this.command = command;
  }
}

export class FileTreeItem extends BaseTreeItem {
  constructor(
    public readonly promptFile: PromptFile,
    command?: vscode.Command
  ) {
    if (!promptFile) {
      throw new Error("FileTreeItem: promptFile cannot be null or undefined");
    }
    if (!promptFile.title) {
      throw new Error(
        "FileTreeItem: promptFile.title cannot be null or undefined"
      );
    }
    super(promptFile.title, vscode.TreeItemCollapsibleState.None, command);

    // Set properties directly after super()
    this.tooltip = this.createTooltip();
    this.description = this.createDescription();
    this.contextValue = "promptFile";
    this.iconPath = new vscode.ThemeIcon("file");
  }

  private createTooltip(): string {
    const tags =
      this.promptFile.tags.length > 0
        ? ` | Tags: ${this.promptFile.tags.join(", ")}`
        : "";
    return `${this.promptFile.title}${tags}`;
  }

  private createDescription(): string | undefined {
    const config = vscode.workspace.getConfiguration("promptManager");
    const showDescription = config.get<boolean>("showDescriptionInTree", true);
    return showDescription ? this.promptFile.description || "" : "";
  }
}

export class FolderTreeItem extends BaseTreeItem {
  constructor(
    public readonly promptFolder: PromptFolder,
    collapsibleState: vscode.TreeItemCollapsibleState = vscode
      .TreeItemCollapsibleState.Expanded
  ) {
    if (!promptFolder) {
      throw new Error(
        "FolderTreeItem: promptFolder cannot be null or undefined"
      );
    }
    if (!promptFolder.name) {
      throw new Error(
        "FolderTreeItem: promptFolder.name cannot be null or undefined"
      );
    }
    super(promptFolder.name, collapsibleState);

    // Set properties directly after super()
    this.tooltip = this.createTooltip();
    this.description = this.createDescription();
    this.contextValue = "promptFolder";
    this.iconPath = new vscode.ThemeIcon("folder");
  }

  private createTooltip(): string {
    return `${this.promptFolder.name}\n${this.promptFolder.prompts.length} prompts`;
  }

  private createDescription(): string | undefined {
    return `${this.promptFolder.prompts.length} prompts`;
  }
}

export class EmptyStateTreeItem extends BaseTreeItem {
  constructor(label: string, description: string, contextValue: string) {
    super(label, vscode.TreeItemCollapsibleState.None);

    // Set properties directly after super()
    this.tooltip = label;
    this.description = description;
    this.contextValue = contextValue;
    this.iconPath = new vscode.ThemeIcon("info");
  }
}

export type PromptTreeItem = FileTreeItem | FolderTreeItem | EmptyStateTreeItem;

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
  private _searchService: SearchService;

  constructor(private promptManager: PromptManager) {
    this._searchService = new SearchService(
      this.promptManager.getFileManager()
    );

    // Listen to changes from PromptManager
    this.promptManager.onDidChangeTreeData(() => {
      this.refresh();
    });
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
      console.log("getRootItems: Starting to get prompt structure");
      const structure = await this.promptManager.getPromptStructure();
      console.log("getRootItems: Got structure", {
        foldersCount: structure?.folders?.length || 0,
        rootPromptsCount: structure?.rootPrompts?.length || 0,
        structure,
      });

      const items: PromptTreeItem[] = [];

      // If search is active, apply filtering
      if (this._currentSearchCriteria?.isActive) {
        console.log("getRootItems: Search is active, getting filtered items");
        return this.getFilteredItems(structure);
      }

      // Add folders
      if (structure?.folders) {
        console.log("getRootItems: Processing folders");
        for (const folder of structure.folders) {
          console.log("getRootItems: Processing folder:", folder);
          if (folder && folder.name) {
            const folderItem = new FolderTreeItem(folder);
            items.push(folderItem);
            console.log("getRootItems: Added folder item:", folder.name);
          } else {
            console.warn("FolderTreeItem: Skipping invalid folder:", folder);
          }
        }
      }

      // Add root prompts
      if (structure?.rootPrompts) {
        console.log("getRootItems: Processing root prompts");
        for (const prompt of structure.rootPrompts) {
          console.log("getRootItems: Processing prompt:", prompt);
          if (prompt && prompt.title) {
            const promptItem = new FileTreeItem(prompt, {
              command: "promptManager.openPrompt",
              title: "Open Prompt",
              arguments: [prompt.path],
            });
            items.push(promptItem);
            console.log("getRootItems: Added prompt item:", prompt.title);
          } else {
            console.warn("FileTreeItem: Skipping invalid prompt:", prompt);
          }
        }
      }

      // If no items, show empty state message
      if (items.length === 0) {
        console.log("getRootItems: No items found, showing empty state");
        const emptyItem = new EmptyStateTreeItem(
          "No prompts yet",
          "Click + to add your first prompt",
          "emptyState"
        );
        items.push(emptyItem);
      }

      console.log("getRootItems: Returning items", { count: items.length });
      return items;
    } catch (error) {
      console.error("Error in getRootItems:", error);
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
      console.warn("getFolderItems: Invalid folder provided:", folder);
      return items;
    }

    for (const prompt of folder.prompts) {
      if (prompt && prompt.title) {
        const promptItem = new FileTreeItem(prompt, {
          command: "promptManager.openPrompt",
          title: "Open Prompt",
          arguments: [prompt.path],
        });
        items.push(promptItem);
      } else {
        console.warn("getFolderItems: Skipping invalid prompt:", prompt);
      }
    }

    // If folder is empty, show empty state
    if (items.length === 0) {
      const emptyItem = new EmptyStateTreeItem(
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
    const structure = await this.promptManager.getPromptStructure();

    // Check root prompts
    for (const prompt of structure.rootPrompts) {
      if (prompt.path === filePath) {
        return new FileTreeItem(prompt);
      }
    }

    // Check folder prompts
    for (const folder of structure.folders) {
      for (const prompt of folder.prompts) {
        if (prompt.path === filePath) {
          return new FileTreeItem(prompt);
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
      console.warn("getFilteredItems: Invalid structure provided");
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
          const promptItem = new FileTreeItem(prompt, {
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
          console.warn("getFilteredItems: Skipping invalid folder:", folder);
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
          const folderItem = new FolderTreeItem(filteredFolder);
          items.push(folderItem);
        }
      }
    }

    // If no matches, show no results message
    if (items.length === 0) {
      const noResultsItem = new EmptyStateTreeItem(
        "No matching prompts",
        `No prompts match "${criteria.query}"`,
        "noResults"
      );
      // Override icon for search results
      noResultsItem.iconPath = new vscode.ThemeIcon("search");
      items.push(noResultsItem);
    }

    return items;
  }

  private async matchesSearchCriteria(
    prompt: PromptFile,
    criteria: SearchCriteria
  ): Promise<boolean> {
    try {
      return await this._searchService.matchesPrompt(prompt, criteria);
    } catch (error) {
      console.error(
        "Error in enhanced search, falling back to simple search:",
        error
      );
      // Fallback to simple text matching
      return this._searchService.matchesTextFallback(prompt, criteria);
    }
  }
}
