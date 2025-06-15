import * as vscode from "vscode";
import { FileNamingPattern } from "./utils/string";

/**
 * Centralized configuration management for Prompt Manager
 * This module provides type-safe access to all configuration values
 * and eliminates string literal duplication and typos.
 */

// Get the base configuration object
export const config = vscode.workspace.getConfiguration("promptManager");

/**
 * Configuration keys - used internally for type safety
 */
export const CONFIG_KEYS = {
  DEFAULT_PROMPT_DIRECTORY: "defaultPromptDirectory",
  FILE_NAMING_PATTERN: "fileNamingPattern",
  SHOW_DESCRIPTION_IN_TREE: "showDescriptionInTree",
} as const;

/**
 * Constants used throughout the extension
 */
export const EXTENSION_CONSTANTS = {
  // Context keys
  WORKSPACE_HAS_PROMPT_MANAGER: "workspaceHasPromptManager",

  // Global state keys
  HAS_SHOWN_WELCOME: "promptManager.hasShownWelcome",

  // View types
  SEARCH_VIEW_TYPE: "promptManagerSearch",
  TREE_VIEW_ID: "promptManagerTree",

  // Default values
  DEFAULT_DIRECTORY: ".prompt_manager",
  DEFAULT_NAMING_PATTERN: "kebab-case" as FileNamingPattern,
} as const;

/**
 * Get the default prompt directory name
 * @returns The configured directory name or ".prompt_manager" as default
 */
export const getDefaultPromptDirectory = (): string =>
  config.get<string>(
    CONFIG_KEYS.DEFAULT_PROMPT_DIRECTORY,
    EXTENSION_CONSTANTS.DEFAULT_DIRECTORY
  );

/**
 * Get the file naming pattern for prompt files
 * @returns The configured naming pattern or "kebab-case" as default
 */
export const getFileNamingPattern = (): FileNamingPattern =>
  config.get<string>(
    CONFIG_KEYS.FILE_NAMING_PATTERN,
    EXTENSION_CONSTANTS.DEFAULT_NAMING_PATTERN
  ) as FileNamingPattern;

/**
 * Get whether to show descriptions in the tree view
 * @returns True if descriptions should be shown, false otherwise
 */
export const getShowDescriptionInTree = (): boolean =>
  config.get<boolean>(CONFIG_KEYS.SHOW_DESCRIPTION_IN_TREE, true);

/**
 * Refresh the configuration cache
 * Call this when configuration values might have changed
 */
export const refreshConfig = (): void => {
  // Re-assign the config object to pick up any changes
  Object.assign(config, vscode.workspace.getConfiguration("promptManager"));
};

/**
 * Watch for configuration changes and refresh automatically
 * @param disposables Array to add the disposable to for cleanup
 */
export const setupConfigWatcher = (disposables: vscode.Disposable[]): void => {
  const configWatcher = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("promptManager")) {
      refreshConfig();
    }
  });

  disposables.push(configWatcher);
};
