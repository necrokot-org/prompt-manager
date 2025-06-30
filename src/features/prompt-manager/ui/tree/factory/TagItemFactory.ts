import { Tag } from "@features/prompt-manager/domain/Tag";
import { TagRootTreeItem } from "../items/TagRootTreeItem";
import { TagTreeItem } from "../items/TagTreeItem";

/**
 * Factory for creating tag-related tree items
 */
export class TagItemFactory {
  /**
   * Create the root "Tags" tree item
   */
  public createTagRootItem(
    hasActiveFilter: boolean = false,
    activeTagValue?: string
  ): TagRootTreeItem {
    return new TagRootTreeItem(hasActiveFilter, activeTagValue);
  }

  /**
   * Create a tag tree item
   */
  public createTagItem(
    tag: Tag,
    isActive: boolean = false,
    promptCount?: number
  ): TagTreeItem {
    return new TagTreeItem(tag, isActive, promptCount);
  }
}
