import * as vscode from "vscode";
import { Tag } from "../../../domain/model/Tag";
import { TagTreeItem } from "../items/TagTreeItem";
import { EmptyStateTreeItem } from "../items/EmptyStateTreeItem";

export class TagItemFactory {
  public createTagItem(tag: Tag, activeTag: Tag | null): TagTreeItem {
    const isActive = activeTag?.equals(tag) || false;
    return new TagTreeItem(tag, isActive);
  }

  public createEmptyStateItem(
    label: string,
    description: string = "",
    contextValue: string = "empty"
  ): EmptyStateTreeItem {
    const item = new EmptyStateTreeItem(label, description, contextValue);
    item.iconPath = new vscode.ThemeIcon("info");
    return item;
  }
}
