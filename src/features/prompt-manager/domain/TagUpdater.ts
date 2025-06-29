import { injectable, inject } from "tsyringe";
import { PromptFile } from "@features/prompt-manager/data/fileManager";
import { Tag } from "./Tag";
import { parsePromptContentSync } from "@root/validation/schemas/prompt";
import { serializePromptContent } from "@root/validation/schemas/prompt";
import { FileSystemManager } from "@infra/fs/FileSystemManager";
import { DI_TOKENS } from "@infra/di/di-tokens";

/**
 * Domain service to update tags in prompts
 */
@injectable()
export class TagUpdater {
  constructor(
    @inject(DI_TOKENS.FileSystemManager)
    private fileSystemManager: FileSystemManager
  ) {}

  /**
   * Rename a tag in a prompt's content
   */
  public async rename(
    oldTag: Tag,
    newTag: Tag,
    prompt: PromptFile
  ): Promise<string> {
    try {
      const content = await this.fileSystemManager.readFile(prompt.path);
      const parsed = parsePromptContentSync(content || "");

      if (!parsed.tags || !Array.isArray(parsed.tags)) {
        return content || "";
      }

      // Replace the old tag with the new tag
      const updatedTags = parsed.tags.map((tagValue) => {
        const currentTag = Tag.from(tagValue);
        return currentTag.equals(oldTag) ? newTag.value : tagValue;
      });

      // Remove duplicates while preserving order
      const uniqueTags = Array.from(new Set(updatedTags));

      // Create updated prompt content
      const updatedPrompt = {
        ...parsed,
        tags: uniqueTags.length > 0 ? uniqueTags : undefined,
      };

      return serializePromptContent(updatedPrompt);
    } catch (error) {
      // If parsing fails, return original content
      const content = await this.fileSystemManager.readFile(prompt.path);
      return content || "";
    }
  }

  /**
   * Delete a tag from a prompt's content
   */
  public async delete(tag: Tag, prompt: PromptFile): Promise<string> {
    try {
      const content = await this.fileSystemManager.readFile(prompt.path);
      const parsed = parsePromptContentSync(content || "");

      if (!parsed.tags || !Array.isArray(parsed.tags)) {
        return content || "";
      }

      // Filter out the tag to delete
      const updatedTags = parsed.tags.filter((tagValue) => {
        const currentTag = Tag.from(tagValue);
        return !currentTag.equals(tag);
      });

      // Create updated prompt content
      const updatedPrompt = {
        ...parsed,
        tags: updatedTags.length > 0 ? updatedTags : undefined,
      };

      return serializePromptContent(updatedPrompt);
    } catch (error) {
      // If parsing fails, return original content
      const content = await this.fileSystemManager.readFile(prompt.path);
      return content || "";
    }
  }

  /**
   * Check if a prompt contains a specific tag
   */
  public async hasTag(tag: Tag, prompt: PromptFile): Promise<boolean> {
    try {
      const content = await this.fileSystemManager.readFile(prompt.path);
      const parsed = parsePromptContentSync(content || "");

      if (!parsed.tags || !Array.isArray(parsed.tags)) {
        return false;
      }

      return parsed.tags.some((tagValue) => {
        try {
          const currentTag = Tag.from(tagValue);
          return currentTag.equals(tag);
        } catch {
          return false;
        }
      });
    } catch {
      return false;
    }
  }
}
