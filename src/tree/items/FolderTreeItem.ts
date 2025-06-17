import * as vscode from "vscode";
import { PromptFolder } from "../../scanner/types";
import { BaseTreeItem } from "./BaseTreeItem";

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
