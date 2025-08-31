import * as vscode from "vscode";
import { Tag } from "../../../domain/model/Tag";
import { BaseTreeItem } from "./BaseTreeItem";

export class TagTreeItem extends BaseTreeItem {
  constructor(public readonly tag: Tag, private isActive: boolean = false) {
    super(tag.value, vscode.TreeItemCollapsibleState.None);

    this.tooltip = `Tag: ${tag.value}`;
    this.description = isActive ? "(active)" : "";
    this.contextValue = "tag";
    this.iconPath = new vscode.ThemeIcon("tag");

    // Add command to select this tag
    this.command = {
      command: "promptManager.selectTag",
      title: "Select Tag",
      arguments: [tag],
    };
  }

  updateActiveState(isActive: boolean): void {
    this.isActive = isActive;
    this.description = isActive ? "(active)" : "";
  }
}
