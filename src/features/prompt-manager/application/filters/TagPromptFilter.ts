import { injectable, inject } from "tsyringe";
import { PromptFile } from "@root/scanner/types";
import { PromptFilter } from "./PromptFilter";
import { TagService } from "../services/TagService";
import { DI_TOKENS } from "@infra/di/di-tokens";

/**
 * Filter that applies tag-based filtering to prompt files
 */
@injectable()
export class TagPromptFilter implements PromptFilter {
  constructor(
    @inject(DI_TOKENS.TagService)
    private tagService: TagService
  ) {}

  async apply(files: PromptFile[]): Promise<PromptFile[]> {
    const activeTag = this.tagService.getActiveTag();

    // If no active tag, return all files unchanged
    if (!activeTag) {
      return files;
    }

    // Filter files that have the active tag
    return files.filter(
      (prompt) => prompt.tags && prompt.tags.includes(activeTag.value)
    );
  }
}
