/**
 * Environment detection types and interfaces for VS Code extension compatibility
 * Supports VS Code, Cursor, and Windserf editors with type-safe detection
 */

/**
 * Supported editor environments
 */
export enum Environment {
  VSCode = "vscode",
  Cursor = "cursor",
  Windserf = "windserf",
  Unknown = "unknown",
}

/**
 * Environment detection service interface
 * Provides methods to detect and query the current editor environment
 */
export interface EnvironmentDetector {
  /**
   * Get the detected environment
   * @returns The current editor environment
   */
  getEnvironment(): Environment;

  /**
   * Check if running in VS Code
   * @returns true if the current environment is VS Code
   */
  isVSCode(): boolean;

  /**
   * Check if running in Cursor
   * @returns true if the current environment is Cursor
   */
  isCursor(): boolean;

  /**
   * Check if running in Windserf
   * @returns true if the current environment is Windserf
   */
  isWindserf(): boolean;

  /**
   * Check if running in an unknown environment
   * @returns true if the current environment is unknown
   */
  isUnknown(): boolean;
}
