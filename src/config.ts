import * as vscode from "vscode";
import { injectable } from "tsyringe";
import { FileNamingPattern } from "./utils/string";
import { eventBus } from "./core/ExtensionBus";

/**
 * Centralized configuration management for Prompt Manager
 * This module provides type-safe access to all configuration values
 * and eliminates string literal duplication and typos.
 * Now integrated with the centralized event system and dependency injection.
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
 * Configuration service that integrates with the event bus and dependency injection
 */
@injectable()
export class ConfigurationService {
  private configWatcher?: vscode.Disposable;

  /**
   * Initialize the configuration service and start watching for changes
   */
  public initialize(): void {
    this.setupConfigWatcher();
  }

  /**
   * Get the default prompt directory name
   */
  public getDefaultPromptDirectory(): string {
    return config.get<string>(
      CONFIG_KEYS.DEFAULT_PROMPT_DIRECTORY,
      EXTENSION_CONSTANTS.DEFAULT_DIRECTORY
    );
  }

  /**
   * Get the file naming pattern for prompt files
   */
  public getFileNamingPattern(): FileNamingPattern {
    return config.get<string>(
      CONFIG_KEYS.FILE_NAMING_PATTERN,
      EXTENSION_CONSTANTS.DEFAULT_NAMING_PATTERN
    ) as FileNamingPattern;
  }

  /**
   * Get whether to show descriptions in the tree view
   */
  public getShowDescriptionInTree(): boolean {
    return config.get<boolean>(CONFIG_KEYS.SHOW_DESCRIPTION_IN_TREE, true);
  }

  /**
   * Watch for configuration changes and publish events
   */
  private setupConfigWatcher(): void {
    this.configWatcher = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("promptManager")) {
        this.handleConfigurationChange(e);
      }
    });
  }

  /**
   * Handle configuration changes and publish appropriate events
   */
  private handleConfigurationChange(e: vscode.ConfigurationChangeEvent): void {
    // Refresh the configuration cache
    Object.assign(config, vscode.workspace.getConfiguration("promptManager"));

    // Check which specific settings changed and publish events
    for (const [key, configKey] of Object.entries(CONFIG_KEYS)) {
      if (e.affectsConfiguration(`promptManager.${configKey}`)) {
        const newValue = config.get(configKey);

        eventBus.emit("config.changed", {
          configKey,
          newValue,
          oldValue: undefined,
        });
      }
    }
  }

  /**
   * Dispose of the configuration service
   */
  public dispose(): void {
    if (this.configWatcher) {
      this.configWatcher.dispose();
    }
  }
}
