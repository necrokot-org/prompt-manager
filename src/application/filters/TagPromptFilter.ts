import { injectable } from "tsyringe";
import { Prompt } from "../../domain/model/Prompt";
import { Tag } from "../../domain/model/Tag";
import { PromptFilter } from "./PromptFilter";

/**
 * Filter that applies tag-based filtering to prompt files
 */
@injectable()
export class TagPromptFilter implements PromptFilter {
  private activeTag: Tag | null = null;

  async apply(files: Prompt[]): Promise<Prompt[]> {
    // If no active tag, return all files unchanged
    if (!this.activeTag) {
      return files;
    }

    // Filter files that have the active tag
    return files.filter(
      (prompt) =>
        prompt.tags &&
        prompt.tags.some((tagValue) => {
          try {
            return Tag.from(tagValue).equals(this.activeTag!);
          } catch {
            return false;
          }
        })
    );
  }

  /**
   * Check if tag filter is currently active
   */
  isActive(): boolean {
    return Boolean(this.activeTag);
  }

  /**
   * Set active tag (called by TagApp)
   */
  setActiveTag(tag: Tag | null): void {
    this.activeTag = tag;
  }
}
