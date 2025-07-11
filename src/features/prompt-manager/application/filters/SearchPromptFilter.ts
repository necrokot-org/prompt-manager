import { injectable, inject } from "tsyringe";
import { PromptFile } from "@root/scanner/types";
import { PromptFilter } from "./PromptFilter";
import { SearchService } from "@features/search/services/searchService";
import { SearchCriteria } from "@features/search/types/SearchCriteria";
import { eventBus } from "@infra/vscode/ExtensionBus";
import { DI_TOKENS } from "@infra/di/di-tokens";

/**
 * Filter that applies search-based filtering to prompt files
 */
@injectable()
export class SearchPromptFilter implements PromptFilter {
  private criteria: SearchCriteria | null = null;
  private subscriptions: any[] = [];

  constructor(
    @inject(DI_TOKENS.SearchService)
    private searchService: SearchService
  ) {
    // Listen to search criteria changes
    this.subscriptions.push(
      eventBus.on("search.criteria.changed", (payload) => {
        const { query, scope, caseSensitive, fuzzy, matchWholeWord, isActive } =
          payload;
        this.criteria = isActive
          ? { query, scope, caseSensitive, fuzzy, matchWholeWord, isActive }
          : null;
      })
    );

    this.subscriptions.push(
      eventBus.on("search.cleared", () => {
        this.criteria = null;
      })
    );
  }

  async apply(files: PromptFile[]): Promise<PromptFile[]> {
    // If no active search criteria, return all files unchanged
    if (!this.criteria?.isActive) {
      return files;
    }

    // Filter files using SearchService
    const filteredFiles: PromptFile[] = [];
    for (const file of files) {
      const matches = await this.searchService.matchesPrompt(
        file,
        this.criteria
      );
      if (matches) {
        filteredFiles.push(file);
      }
    }

    return filteredFiles;
  }

  /**
   * Check if search filter is currently active
   */
  isActive(): boolean {
    return Boolean(this.criteria?.isActive);
  }

  /**
   * Cleanup subscriptions
   */
  dispose(): void {
    this.subscriptions.forEach((subscription) => {
      if (subscription && typeof subscription.dispose === "function") {
        subscription.dispose();
      }
    });
    this.subscriptions = [];
  }
}
