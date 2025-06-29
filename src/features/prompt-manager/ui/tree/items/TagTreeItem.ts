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

    if (isActive) {
      this.iconPath = new vscode.ThemeIcon(
        "tag",
        new vscode.ThemeColor("charts.blue")
      );
      // optional extra visual
      this.description = "active";
    } else {
      this.iconPath = new vscode.ThemeIcon("tag");
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
