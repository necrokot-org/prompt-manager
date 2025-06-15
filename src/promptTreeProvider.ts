import * as vscode from "vscode";
import * as path from "path";
import { PromptManager } from "./promptManager";
import {
  PromptFile,
  PromptFolder,
  ContentSearchResult,
  SearchMatch,
} from "./fileManager";
import { SearchCriteria } from "./searchPanelProvider";

export class PromptTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly promptFile?: PromptFile,
    public readonly promptFolder?: PromptFolder,
    public readonly command?: vscode.Command
  ) {
    super(label, collapsibleState);

    this.tooltip = this.getTooltip();
    this.description = this.getDescription();
    this.contextValue = this.getContextValue();
    this.iconPath = this.getIconPath();
  }

  private getTooltip(): string {
    if (this.promptFile) {
      const tags =
        this.promptFile.tags.length > 0
          ? ` | Tags: ${this.promptFile.tags.join(", ")}`
          : "";
      return `${this.promptFile.title}${tags}`;
    }
    if (this.promptFolder) {
      return `${this.promptFolder.name}\n${this.promptFolder.prompts.length} prompts`;
    }
    return this.label;
  }

  private getDescription(): string | undefined {
    const config = vscode.workspace.getConfiguration("promptManager");
    const showDescription = config.get<boolean>("showDescriptionInTree", true);

    if (this.promptFile) {
      return showDescription ? this.promptFile.description || "" : "";
    }
    if (this.promptFolder) {
      return `${this.promptFolder.prompts.length} prompts`;
    }
    return undefined;
  }

  private getContextValue(): string {
    if (this.promptFile) {
      return "promptFile";
    }
    if (this.promptFolder) {
      return "promptFolder";
    }
    return "unknown";
  }

  private getIconPath(): vscode.ThemeIcon {
    if (this.promptFile) {
      return new vscode.ThemeIcon("file");
    }
    if (this.promptFolder) {
      return new vscode.ThemeIcon("folder");
    }
    return new vscode.ThemeIcon("question");
  }
}

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

  constructor(private promptManager: PromptManager) {
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

    if (element.promptFolder) {
      // Return prompts in this folder
      return this.getFolderItems(element.promptFolder);
    }

    return [];
  }

  private async getRootItems(): Promise<PromptTreeItem[]> {
    const structure = await this.promptManager.getPromptStructure();
    const items: PromptTreeItem[] = [];

    // If search is active, apply filtering
    if (this._currentSearchCriteria?.isActive) {
      return this.getFilteredItems(structure);
    }

    // Add folders
    for (const folder of structure.folders) {
      const folderItem = new PromptTreeItem(
        folder.name,
        vscode.TreeItemCollapsibleState.Expanded,
        undefined,
        folder
      );
      items.push(folderItem);
    }

    // Add root prompts
    for (const prompt of structure.rootPrompts) {
      const promptItem = new PromptTreeItem(
        prompt.title,
        vscode.TreeItemCollapsibleState.None,
        prompt,
        undefined,
        {
          command: "promptManager.openPrompt",
          title: "Open Prompt",
          arguments: [prompt.path],
        }
      );
      items.push(promptItem);
    }

    // If no items, show empty state message
    if (items.length === 0) {
      const emptyItem = new PromptTreeItem(
        "No prompts yet",
        vscode.TreeItemCollapsibleState.None
      );
      emptyItem.description = "Click + to add your first prompt";
      emptyItem.iconPath = new vscode.ThemeIcon("info");
      emptyItem.contextValue = "emptyState";
      items.push(emptyItem);
    }

    return items;
  }

  private getFolderItems(folder: PromptFolder): PromptTreeItem[] {
    const items: PromptTreeItem[] = [];

    for (const prompt of folder.prompts) {
      const promptItem = new PromptTreeItem(
        prompt.title,
        vscode.TreeItemCollapsibleState.None,
        prompt,
        undefined,
        {
          command: "promptManager.openPrompt",
          title: "Open Prompt",
          arguments: [prompt.path],
        }
      );
      items.push(promptItem);
    }

    // If folder is empty, show empty state
    if (items.length === 0) {
      const emptyItem = new PromptTreeItem(
        "No prompts in this folder",
        vscode.TreeItemCollapsibleState.None
      );
      emptyItem.description = "Right-click folder to add prompts";
      emptyItem.iconPath = new vscode.ThemeIcon("info");
      emptyItem.contextValue = "emptyFolder";
      items.push(emptyItem);
    }

    return items;
  }

  // Helper method to get tree item by path (useful for commands)
  public async findTreeItemByPath(
    filePath: string
  ): Promise<PromptTreeItem | undefined> {
    const structure = await this.promptManager.getPromptStructure();

    // Check root prompts
    for (const prompt of structure.rootPrompts) {
      if (prompt.path === filePath) {
        return new PromptTreeItem(
          prompt.title,
          vscode.TreeItemCollapsibleState.None,
          prompt
        );
      }
    }

    // Check folder prompts
    for (const folder of structure.folders) {
      for (const prompt of folder.prompts) {
        if (prompt.path === filePath) {
          return new PromptTreeItem(
            prompt.title,
            vscode.TreeItemCollapsibleState.None,
            prompt
          );
        }
      }
    }

    return undefined;
  }

  private async getFilteredItems(structure: any): Promise<PromptTreeItem[]> {
    const items: PromptTreeItem[] = [];
    const criteria = this._currentSearchCriteria!;
    let totalMatches = 0;

    // Search through root prompts
    for (const prompt of structure.rootPrompts) {
      if (await this.matchesSearchCriteria(prompt, criteria)) {
        const promptItem = new PromptTreeItem(
          prompt.title,
          vscode.TreeItemCollapsibleState.None,
          prompt,
          undefined,
          {
            command: "promptManager.openPrompt",
            title: "Open Prompt",
            arguments: [prompt.path],
          }
        );
        items.push(promptItem);
        totalMatches++;
      }
    }

    // Search through folders and their prompts
    for (const folder of structure.folders) {
      const matchingPrompts: PromptTreeItem[] = [];

      for (const prompt of folder.prompts) {
        if (await this.matchesSearchCriteria(prompt, criteria)) {
          const promptItem = new PromptTreeItem(
            prompt.title,
            vscode.TreeItemCollapsibleState.None,
            prompt,
            undefined,
            {
              command: "promptManager.openPrompt",
              title: "Open Prompt",
              arguments: [prompt.path],
            }
          );
          matchingPrompts.push(promptItem);
          totalMatches++;
        }
      }

      // If folder has matching prompts, include the folder with just those prompts
      if (matchingPrompts.length > 0) {
        const folderItem = new PromptTreeItem(
          `${folder.name} (${matchingPrompts.length})`,
          vscode.TreeItemCollapsibleState.Expanded,
          undefined,
          {
            ...folder,
            prompts: matchingPrompts.map((item) => item.promptFile!),
          }
        );
        items.push(folderItem);
      }
    }

    // If no matches, show no results message
    if (items.length === 0) {
      const noResultsItem = new PromptTreeItem(
        "No matching prompts",
        vscode.TreeItemCollapsibleState.None
      );
      noResultsItem.description = `No prompts match "${criteria.query}"`;
      noResultsItem.iconPath = new vscode.ThemeIcon("search");
      noResultsItem.contextValue = "noResults";
      items.push(noResultsItem);
    }

    return items;
  }

  private async matchesSearchCriteria(
    prompt: PromptFile,
    criteria: SearchCriteria
  ): Promise<boolean> {
    // Use enhanced search functionality from FileManager
    const fileManager = this.promptManager.getFileManager();

    try {
      let results: ContentSearchResult[] = [];

      switch (criteria.scope) {
        case "titles":
          results = await fileManager.searchInTitle(criteria.query, {
            caseSensitive: criteria.caseSensitive,
            exact: false,
          });
          break;
        case "content":
          results = await fileManager.searchInContent(criteria.query, {
            caseSensitive: criteria.caseSensitive,
            exact: false,
            includeYaml: false,
          });
          break;
        case "both":
          const titleResults = await fileManager.searchInTitle(criteria.query, {
            caseSensitive: criteria.caseSensitive,
            exact: false,
          });
          const contentResults = await fileManager.searchInContent(
            criteria.query,
            {
              caseSensitive: criteria.caseSensitive,
              exact: false,
              includeYaml: false,
            }
          );
          results = [...titleResults, ...contentResults];
          break;
        default:
          return false;
      }

      // Check if this specific prompt is in the results
      return results.some((result) => result.file.path === prompt.path);
    } catch (error) {
      console.error(
        "Error in enhanced search, falling back to simple search:",
        error
      );
      // Fallback to simple text matching
      return this.matchesTextFallback(prompt, criteria);
    }
  }

  private matchesText(
    text: string,
    query: string,
    caseSensitive: boolean
  ): boolean {
    const searchText = caseSensitive ? text : text.toLowerCase();
    const searchQuery = caseSensitive ? query : query.toLowerCase();
    return searchText.includes(searchQuery);
  }

  private matchesTextFallback(
    prompt: PromptFile,
    criteria: SearchCriteria
  ): boolean {
    // Fallback method for simple text search when enhanced search fails
    const query = criteria.caseSensitive
      ? criteria.query
      : criteria.query.toLowerCase();

    switch (criteria.scope) {
      case "titles":
        return this.matchesText(prompt.title, query, criteria.caseSensitive);
      case "content":
        // Search in description and tags as fallback
        const searchableContent = [
          prompt.description || "",
          ...(prompt.tags || []),
        ].join(" ");
        return this.matchesText(
          searchableContent,
          query,
          criteria.caseSensitive
        );
      case "both":
        return (
          this.matchesText(prompt.title, query, criteria.caseSensitive) ||
          this.matchesText(
            [prompt.description || "", ...(prompt.tags || [])].join(" "),
            query,
            criteria.caseSensitive
          )
        );
      default:
        return false;
    }
  }
}
