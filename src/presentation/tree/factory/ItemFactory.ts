import * as vscode from "vscode";
import { ConfigReader } from "../../../application/ports/ConfigReader";
import { Prompt } from "../../../domain/model/Prompt";
import { Folder } from "../../../domain/model/Folder";
import { FileTreeItem } from "../items/FileTreeItem";
import { FolderTreeItem } from "../items/FolderTreeItem";
import { EmptyStateTreeItem } from "../items/EmptyStateTreeItem";

export class ItemFactory {
  constructor(private configReader: ConfigReader) {}

  public createFileTreeItem(
    promptFile: Prompt,
    command?: vscode.Command
  ): FileTreeItem {
    const showDescription = this.configReader.getShowDescriptionInTree();
    const openCommand = command || {
      command: "promptManager.openPrompt",
      title: "Open Prompt",
      arguments: [promptFile.path],
    };
    return new FileTreeItem(promptFile, openCommand, showDescription);
  }

  public createFolderTreeItem(promptFolder: Folder): FolderTreeItem {
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
