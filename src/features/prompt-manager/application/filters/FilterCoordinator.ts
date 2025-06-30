import { injectable, injectAll } from "tsyringe";
import { PromptFilter } from "./PromptFilter";
import { PromptStructure, PromptFile } from "@root/scanner/types";
import { DI_TOKENS } from "@infra/di/di-tokens";

/**
 * Coordinates multiple prompt filters to produce a final filtered list
 */
@injectable()
export class FilterCoordinator {
  constructor(
    @injectAll(DI_TOKENS.PromptFilter)
    private readonly filters: PromptFilter[]
  ) {}

  /**
   * Apply all registered filters to the prompt structure and return filtered prompts
   * @param structure The prompt structure to filter
   * @returns Array of prompt files that pass all filters
   */
  async filterAll(structure: PromptStructure): Promise<PromptFile[]> {
    // Extract all prompts from the structure
    let files = [
      ...structure.rootPrompts,
      ...structure.folders.flatMap((f) => f.prompts),
    ];

    // Apply each filter in sequence
    for (const filter of this.filters) {
      files = await filter.apply(files);
    }

    return files;
  }

  /**
   * Get the number of registered filters
   */
  getFilterCount(): number {
    return this.filters.length;
  }

  /**
   * Check if any filters are registered
   */
  hasFilters(): boolean {
    return this.filters.length > 0;
  }

  /**
   * Check if any filters are currently active
   */
  hasActiveFilters(): boolean {
    return this.filters.some((filter) => filter.isActive());
  }
}
