import * as vscode from "vscode";
import { TagApp } from "../../application/TagApp";
import { IndexApp } from "../../application/IndexApp";
import { Tag } from "../../domain/model/Tag";
import { BaseTreeItem, TagTreeItem, TagRootTreeItem } from "./items";
import { TagItemFactory } from "./factory";

/**
 * Simplified tree view for tags using the new application services
 */
export class TagTreeView implements vscode.TreeDataProvider<BaseTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    BaseTreeItem | undefined | null | void
  > = new vscode.EventEmitter<BaseTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    BaseTreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  private tagItemFactory: TagItemFactory;

  constructor(private tagApp: TagApp, private indexApp: IndexApp) {
    this.tagItemFactory = new TagItemFactory();

    // Listen only to tag-specific changes to avoid refresh loops
    // TagApp already listens to prompt structure changes and updates tags accordingly
    this.tagApp.onTagsChanged(() => this.refresh());
  }

  async getChildren(element?: BaseTreeItem): Promise<BaseTreeItem[]> {
    if (!element) {
      // Root level - show all tags
      const tags = await this.tagApp.list();
      if (tags.length === 0) {
        return [this.tagItemFactory.createEmptyStateItem("No tags found")];
      }

      return tags.map((tag) =>
        this.tagItemFactory.createTagItem(tag, this.tagApp.getActiveTag())
      );
    }

    return [];
  }

  getTreeItem(element: BaseTreeItem): vscode.TreeItem {
    return element;
  }

  private refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }
}
