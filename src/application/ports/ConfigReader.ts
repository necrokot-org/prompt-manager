import { FileNamingPattern } from "../../utils/string";

/**
 * Port for reading configuration values from the application layer
 * This interface defines the contract that infrastructure must implement
 * to provide configuration data to the application layer.
 */
export interface ConfigReader {
  /**
   * Get the default prompt directory name
   */
  getDefaultPromptDirectory(): string;

  /**
   * Get the file naming pattern for prompt files
   */
  getFileNamingPattern(): FileNamingPattern;

  /**
   * Get whether to show descriptions in the tree view
   */
  getShowDescriptionInTree(): boolean;

  /**
   * Get whether verbose debug logging is enabled
   */
  getDebugLogging(): boolean;
}
