import { PromptFile } from "@root/scanner/types";

/**
 * Interface for filtering prompt files
 * Implementations can mutate or return a new subset of prompts
 */
export interface PromptFilter {
  /**
   * Apply this filter to the given list of prompt files
   * @param files List of prompt files to filter
   * @returns Filtered list of prompt files
   */
  apply(files: PromptFile[]): Promise<PromptFile[]>;

  /**
   * Check if this filter is currently active
   * @returns true if the filter is active and will modify the result set
   */
  isActive(): boolean;
}
