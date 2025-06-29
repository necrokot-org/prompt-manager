import * as vscode from "vscode";
import { BaseTreeItem } from "./BaseTreeItem";
import { Tag } from "@features/prompt-manager/domain/Tag";

/**
 * Tree item representing an individual tag
 */
export class TagTreeItem extends BaseTreeItem {
  public readonly contextValue = "tag";
  public readonly tag: Tag;

  constructor(tag: Tag, isActive: boolean = false, promptCount?: number) {
    const label =
      promptCount !== undefined ? `${tag.value} (${promptCount})` : tag.value;

    super(label, vscode.TreeItemCollapsibleState.None, {
      command: "promptManager.selectTag",
      title: "Filter by Tag",
      arguments: [tag.value],
    });

    this.tag = tag;

    // Use different icons and theme colors for active vs inactive tags
    if (isActive) {
      this.iconPath = new vscode.ThemeIcon(
        "tag-filled",
        new vscode.ThemeColor("charts.blue")
      );
      this.resourceUri = vscode.Uri.parse(`tag:${tag.value}?active=true`);
    } else {
      this.iconPath = new vscode.ThemeIcon(
        "tag",
        new vscode.ThemeColor("foreground")
      );
    }

    this.tooltip = isActive
      ? `Currently filtering by: ${tag.value}${
          promptCount !== undefined ? ` (${promptCount} prompts)` : ""
        }`
      : `Click to filter by: ${tag.value}${
          promptCount !== undefined ? ` (${promptCount} prompts)` : ""
        }`;
  }
}
