import * as vscode from "vscode";
import { BaseTreeItem } from "./BaseTreeItem";

/**
 * Tree item representing the root "Tags" node
 */
export class TagRootTreeItem extends BaseTreeItem {
  public readonly contextValue = "tagRoot";

  constructor(hasActiveFilter: boolean = false, activeTagValue?: string) {
    const label =
      hasActiveFilter && activeTagValue
        ? `Tags (filtering by: ${activeTagValue})`
        : "Tags";

    super(label, vscode.TreeItemCollapsibleState.Expanded);

    if (hasActiveFilter) {
      this.iconPath = new vscode.ThemeIcon(
        "filter-filled",
        new vscode.ThemeColor("charts.blue")
      );
      this.tooltip = `Filter prompts by tags - Currently filtering by: ${activeTagValue}`;
    } else {
      this.iconPath = new vscode.ThemeIcon("tag");
      this.tooltip = "Filter prompts by tags";
    }
  }
}
