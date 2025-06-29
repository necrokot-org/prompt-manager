import { Tag } from "@features/prompt-manager/domain/Tag";

/**
 * Interface for managing tag filter state with workspace persistence
 */
export interface TagFilterState {
  /**
   * Get the currently active tag filter
   */
  getActiveTag(): Tag | undefined;

  /**
   * Set the active tag filter (undefined to clear)
   */
  setActiveTag(tag: Tag | undefined): Promise<void>;
}
