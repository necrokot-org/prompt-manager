import * as vscode from "vscode";
import { BaseTreeItem } from "./BaseTreeItem";

export class EmptyStateTreeItem extends BaseTreeItem {
  constructor(label: string, description: string, contextValue: string) {
    super(label, vscode.TreeItemCollapsibleState.None);

    this.tooltip = label;
    this.description = description;
    this.contextValue = contextValue;
    this.iconPath = new vscode.ThemeIcon("info");
  }
}
