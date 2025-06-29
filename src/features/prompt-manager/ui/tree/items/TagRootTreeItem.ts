import * as vscode from "vscode";
import { BaseTreeItem } from "./BaseTreeItem";

/**
 * Tree item representing the root "Tags" node
 */
export class TagRootTreeItem extends BaseTreeItem {
  constructor(hasActiveFilter: boolean = false, activeTagValue?: string) {
    super(
      hasActiveFilter && activeTagValue
        ? `Tags (filter: ${activeTagValue})`
        : "Tags",
      vscode.TreeItemCollapsibleState.Expanded
    );

    this.contextValue = hasActiveFilter ? "tagRootActive" : "tagRoot";

    this.iconPath = new vscode.ThemeIcon(
      hasActiveFilter ? "filter-filled" : "tag",
      hasActiveFilter ? new vscode.ThemeColor("charts.blue") : undefined
    );

    if (hasActiveFilter) {
      // clicking entire root also clears filter
      this.command = {
        command: "promptManager.clearTagFilter",
        title: "Clear Tag Filter",
      };
      this.tooltip = `Currently filtering by: ${activeTagValue}. Click to clear filter.`;
    } else {
      this.tooltip = "Filter prompts by tags";
    }
  }
}
