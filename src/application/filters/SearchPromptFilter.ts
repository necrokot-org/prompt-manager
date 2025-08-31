import { injectable, inject } from "tsyringe";
import { Prompt } from "../../domain/model/Prompt";
import { SearchQuery } from "../../domain/model/SearchQuery";
import { PromptFilter } from "./PromptFilter";
import { SearchEngine } from "../ports/SearchEngine";
import { DI_TOKENS } from "../../infrastructure/di/di-tokens";

/**
 * Filter that applies search-based filtering to prompt files
 */
@injectable()
export class SearchPromptFilter implements PromptFilter {
  private criteria: SearchQuery | null = null;
  private matchedIdsCache: Set<string> | null = null;
  private cacheCriteria: SearchQuery | null = null;

  constructor(
    @inject(DI_TOKENS.SearchEngine)
    private readonly searchEngine: SearchEngine
  ) {}

  async apply(files: Prompt[]): Promise<Prompt[]> {
    // If no active search criteria, return all files unchanged
    if (!this.criteria?.isActive) {
      return files;
    }

    // Get or compute matched IDs for current criteria
    const matchedIds = await this.getMatchedIds();

    // Filter files by membership in matched IDs set
    return files.filter((file) => matchedIds.has(file.path));
  }

  /**
   * Check if search filter is currently active
   */
  isActive(): boolean {
    return Boolean(this.criteria?.isActive);
  }

  /**
   * Set search criteria (called by SearchApp)
   */
  setCriteria(criteria: SearchQuery | null): void {
    // Invalidate cache if criteria changed
    if (this.hasCriteriaChanged(criteria)) {
      this.matchedIdsCache = null;
      this.cacheCriteria = null;
    }
    this.criteria = criteria;
  }

  /**
   * Get matched IDs for current criteria, computing them if not cached
   */
  private async getMatchedIds(): Promise<Set<string>> {
    if (!this.criteria?.isActive) {
      return new Set();
    }

    // Return cached result if criteria hasn't changed
    if (
      this.matchedIdsCache &&
      this.cacheCriteria &&
      this.areCriteriaEqual(this.criteria, this.cacheCriteria)
    ) {
      return this.matchedIdsCache;
    }

    // Compute matched IDs using a single search call
    const searchResults = this.searchEngine.search(this.criteria);
    const matchedIds = new Set(searchResults.map((result) => result.id));

    // Cache the result
    this.matchedIdsCache = matchedIds;
    this.cacheCriteria = { ...this.criteria };

    return matchedIds;
  }

  /**
   * Check if criteria has changed compared to cached criteria
   */
  private hasCriteriaChanged(newCriteria: SearchQuery | null): boolean {
    if (!this.cacheCriteria && !newCriteria) {return false;}
    if (!this.cacheCriteria || !newCriteria) {return true;}
    return !this.areCriteriaEqual(this.cacheCriteria, newCriteria);
  }

  /**
   * Compare two search criteria for equality
   */
  private areCriteriaEqual(a: SearchQuery, b: SearchQuery): boolean {
    return (
      a.query === b.query &&
      a.scope === b.scope &&
      a.caseSensitive === b.caseSensitive &&
      a.isActive === b.isActive &&
      JSON.stringify(a.fuzzy) === JSON.stringify(b.fuzzy)
    );
  }
}
