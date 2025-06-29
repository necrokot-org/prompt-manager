import { injectable, inject } from "tsyringe";
import { PromptFile } from "@features/prompt-manager/data/fileManager";
import { Tag } from "./Tag";
import { parsePromptContentSync } from "@root/validation/schemas/prompt";
import { FileSystemManager } from "@infra/fs/FileSystemManager";
import { DI_TOKENS } from "@infra/di/di-tokens";

/**
 * Domain service to extract tags from prompts
 */
@injectable()
export class TagExtractor {
  constructor(
    @inject(DI_TOKENS.FileSystemManager)
    private fileSystemManager: FileSystemManager
  ) {}

  /**
   * Extract tags from a prompt file
   */
  public async extractFromPrompt(prompt: PromptFile): Promise<Set<Tag>> {
    const tags = new Set<Tag>();

    try {
      // If the prompt already has tags parsed, use those
      if (prompt.tags && Array.isArray(prompt.tags)) {
        prompt.tags.forEach((tagValue) => {
          try {
            tags.add(Tag.from(tagValue));
          } catch (error) {
            // Skip invalid tags
          }
        });
        return tags;
      }

      // Read file content to parse tags from front matter
      const content = await this.fileSystemManager.readFile(prompt.path);
      if (content) {
        const parsed = parsePromptContentSync(content);
        if (parsed.tags && Array.isArray(parsed.tags)) {
          parsed.tags.forEach((tagValue) => {
            try {
              tags.add(Tag.from(tagValue));
            } catch (error) {
              // Skip invalid tags
            }
          });
        }
      }
    } catch (error) {
      // Return empty set if parsing fails
    }

    return tags;
  }

  /**
   * Extract all unique tags from multiple prompts
   */
  public async extractFromPrompts(prompts: PromptFile[]): Promise<Set<Tag>> {
    const allTags = new Set<Tag>();

    for (const prompt of prompts) {
      const promptTags = await this.extractFromPrompt(prompt);
      promptTags.forEach((tag) => allTags.add(tag));
    }

    return allTags;
  }

  /**
   * Get tags as sorted string array
   */
  public getTagsAsArray(tags: Set<Tag>): string[] {
    return Array.from(tags)
      .map((tag) => tag.value)
      .sort();
  }
}
