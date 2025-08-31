import { injectable, injectAll } from "tsyringe";
import * as path from "path";
import { PromptFilter } from "./PromptFilter";
import { PromptStructure } from "../../domain/model/PromptStructure";
import { APP_TOKENS } from "../di-tokens";

/**
 * Coordinates multiple prompt filters to produce a final filtered list
 */
@injectable()
export class FilterCoordinator {
  constructor(
    @injectAll(APP_TOKENS.PromptFilter)
    private readonly filters: PromptFilter[]
  ) {}

  /**
   * Apply all registered filters to the prompt structure
   * @param structure The prompt structure to filter
   * @returns Filtered structure if filters are active, original structure otherwise
   */
  async apply(structure: PromptStructure): Promise<PromptStructure> {
    if (!this.hasActiveFilters()) {
      return structure;
    }

    // Start with all prompts (root + in folders)
    let files = [
      ...structure.rootPrompts,
      ...structure.folders.flatMap((f) => f.prompts),
    ];

    // Apply filters
    for (const filter of this.filters) {
      files = await filter.apply(files);
    }

    // Build a quick lookup of matched prompt paths
    const matchedIds = new Set(files.map((f) => f.path));

    // Filter root prompts
    const rootPrompts = structure.rootPrompts.filter((p) =>
      matchedIds.has(p.path)
    );

    // Map folders by path to preserve original folder entries and order
    const allFolders = structure.folders ?? [];
    const folderByPath = new Map(allFolders.map((f) => [f.path, f]));

    // Determine which folders have matched prompts
    const foldersWithPrompts = new Set(
      allFolders
        .filter((f) => f.prompts.some((p) => matchedIds.has(p.path)))
        .map((f) => f.path)
    );

    // Include ancestor folders so nesting is preserved
    const keptFolderPaths = new Set<string>(foldersWithPrompts);
    for (const folderPath of Array.from(foldersWithPrompts)) {
      let parent = path.dirname(folderPath);
      while (folderByPath.has(parent)) {
        if (keptFolderPaths.has(parent)) break;
        keptFolderPaths.add(parent);
        const next = path.dirname(parent);
        if (next === parent) break;
        parent = next;
      }
    }

    // Rebuild folders with filtered prompts; keep only selected folders
    const folders = allFolders
      .filter((f) => keptFolderPaths.has(f.path))
      .map((f) => ({
        name: f.name,
        path: f.path,
        prompts: f.prompts.filter((p) => matchedIds.has(p.path)),
      }));

    return { folders, rootPrompts };
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
