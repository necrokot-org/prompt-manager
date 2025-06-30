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
}
