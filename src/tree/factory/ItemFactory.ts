import * as vscode from "vscode";
import { ConfigurationService } from "../../config";
import { PromptFile, PromptFolder } from "../../scanner/types";
import { FileTreeItem } from "../items/FileTreeItem";
import { FolderTreeItem } from "../items/FolderTreeItem";
import { EmptyStateTreeItem } from "../items/EmptyStateTreeItem";

export class ItemFactory {
  constructor(private configService: ConfigurationService) {}

  public createFileTreeItem(
    promptFile: PromptFile,
    command?: vscode.Command
  ): FileTreeItem {
    const showDescription = this.configService.getShowDescriptionInTree();
    return new FileTreeItem(promptFile, command, showDescription);
  }

  public createFolderTreeItem(promptFolder: PromptFolder): FolderTreeItem {
    return new FolderTreeItem(promptFolder);
  }

  public createEmptyStateItem(
    label: string,
    description: string,
    contextValue: string,
    icon: vscode.ThemeIcon = new vscode.ThemeIcon("info")
  ): EmptyStateTreeItem {
    const item = new EmptyStateTreeItem(label, description, contextValue);
    item.iconPath = icon;
    return item;
  }
}
