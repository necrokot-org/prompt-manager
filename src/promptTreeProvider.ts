import * as vscode from "vscode";
import * as path from "path";
import { PromptManager } from "./promptManager";
import { PromptFile, PromptFolder } from "./fileManager";

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
      return `${
        this.promptFile.title
      }${tags}\nModified: ${this.promptFile.modified.toLocaleDateString()}`;
    }
    if (this.promptFolder) {
      return `${this.promptFolder.name}\n${this.promptFolder.prompts.length} prompts`;
    }
    return this.label;
  }

  private getDescription(): string | undefined {
    if (this.promptFile) {
      return this.promptFile.description || "";
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

  constructor(private promptManager: PromptManager) {
    // Listen to changes from PromptManager
    this.promptManager.onDidChangeTreeData(() => {
      this.refresh();
    });
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
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
}
