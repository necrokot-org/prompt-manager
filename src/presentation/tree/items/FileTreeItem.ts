import * as vscode from "vscode";
import type { Prompt } from "../../../domain/model/Prompt";
import { BaseTreeItem } from "./BaseTreeItem";

export class FileTreeItem extends BaseTreeItem {
  constructor(
    public readonly promptFile: Prompt,
    command?: vscode.Command,
    private showDescriptionInTree: boolean = true
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

    this.resourceUri = vscode.Uri.file(promptFile.path);
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
    return this.showDescriptionInTree ? this.promptFile.description || "" : "";
  }
}
