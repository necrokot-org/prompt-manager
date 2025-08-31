import * as vscode from "vscode";
import * as path from "path";
import { PromptApp } from "../../application/PromptApp";
import { TagApp } from "../../application/TagApp";
import { SearchApp } from "../../application/SearchApp";
import { PromptStructure } from "../../domain/model/PromptStructure";
import { ConfigReader } from "../../application/ports/ConfigReader";
import { BaseTreeItem, FileTreeItem, FolderTreeItem } from "./items";
import { ItemFactory } from "./factory";

/**
 * Simplified tree view for prompts using the new application services
 */
export class PromptTreeView
  implements
    vscode.TreeDataProvider<BaseTreeItem>,
    vscode.TreeDragAndDropController<BaseTreeItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    BaseTreeItem | undefined | null | void
  > = new vscode.EventEmitter<BaseTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    BaseTreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  private itemFactory: ItemFactory;
  private currentStructure: PromptStructure | null = null;

  constructor(
    private promptApp: PromptApp,
    private tagApp: TagApp,
    private searchApp: SearchApp,
    private configReader: ConfigReader
  ) {
    this.itemFactory = new ItemFactory(configReader);

    // Listen to app events
    this.promptApp.onTreeChanged(() => this.refresh());
    this.tagApp.onTagsChanged(() => this.refresh());
    this.searchApp.onSearchChanged(() => this.refresh());
  }

  async getChildren(element?: BaseTreeItem): Promise<BaseTreeItem[]> {
    if (!element) {
      this.currentStructure = await this.promptApp.structure();
      if (!this.currentStructure) return [];

      const allFolders = this.currentStructure.folders ?? [];
      const folderPaths = new Set(allFolders.map((f) => f.path));
      const rootFolders = allFolders.filter(
        (f) => !folderPaths.has(path.dirname(f.path))
      );

      const items: BaseTreeItem[] = [];
      for (const folder of rootFolders) {
        items.push(this.itemFactory.createFolderTreeItem(folder));
      }
      for (const prompt of this.currentStructure.rootPrompts) {
        items.push(this.itemFactory.createFileTreeItem(prompt));
      }
      return items;
    }

    if (element instanceof FolderTreeItem) {
      const folderPath = element.resourceUri?.fsPath;
      if (!folderPath || !this.currentStructure) return [];

      const subfolders = this.currentStructure.folders.filter(
        (f) => path.dirname(f.path) === folderPath
      );
      const items: BaseTreeItem[] = subfolders.map((f) =>
        this.itemFactory.createFolderTreeItem(f)
      );

      const thisFolder = this.currentStructure.folders.find(
        (f) => f.path === folderPath
      );
      if (thisFolder) {
        items.push(
          ...thisFolder.prompts.map((p) =>
            this.itemFactory.createFileTreeItem(p)
          )
        );
      }
      return items;
    }

    return [];
  }

  getTreeItem(element: BaseTreeItem): vscode.TreeItem {
    return element;
  }

  // Drag and drop support
  dropMimeTypes = ["application/vnd.code.tree.promptmanager"];
  dragMimeTypes = ["application/vnd.code.tree.promptmanager"];

  handleDrag(
    source: readonly BaseTreeItem[],
    dataTransfer: vscode.DataTransfer
  ): void {
    // Implement drag logic
  }

  handleDrop(
    target: BaseTreeItem | undefined,
    dataTransfer: vscode.DataTransfer
  ): void {
    // Implement drop logic
  }

  private buildTreeItems(structure: PromptStructure): BaseTreeItem[] {
    const items: BaseTreeItem[] = [];

    const allFolders = structure.folders ?? [];
    const folderPaths = new Set(allFolders.map((f) => f.path));
    const rootFolders = allFolders.filter(
      (f) => !folderPaths.has(path.dirname(f.path))
    );

    for (const folder of rootFolders) {
      items.push(this.itemFactory.createFolderTreeItem(folder));
    }
    for (const prompt of structure.rootPrompts) {
      items.push(this.itemFactory.createFileTreeItem(prompt));
    }

    return items;
  }

  private refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }
}
