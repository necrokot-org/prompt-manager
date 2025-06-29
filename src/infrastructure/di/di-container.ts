import "reflect-metadata";
import { container } from "tsyringe";
import * as vscode from "vscode";
import { DI_TOKENS } from "./di-tokens";
import { PromptController } from "@features/prompt-manager/domain/promptController";
import { PromptRepository } from "@features/prompt-manager/domain/promptRepository";
import { PromptTreeProvider } from "@features/prompt-manager/ui/tree/PromptTreeProvider";
import { SearchPanelProvider } from "@features/search/ui/SearchPanelProvider";
import { FileManager } from "@features/prompt-manager/data/fileManager";
import { SearchService } from "@features/search/services/searchService";
import { ConfigurationService } from "@infra/config/config";
import { FileSystemManager } from "@infra/fs/FileSystemManager";
import { CommandHandler } from "../../extension/commands/commandHandler";
import { EnvironmentDetector } from "@infra/config/EnvironmentDetector";

// Tag-related imports
import { TagExtractor } from "@features/prompt-manager/domain/TagExtractor";
import { TagUpdater } from "@features/prompt-manager/domain/TagUpdater";
import { TagService } from "@features/prompt-manager/application/services/TagService";
import { FileTagRepository } from "@features/prompt-manager/infrastructure/repositories/FileTagRepository";
import { PersistentTagFilter } from "@features/prompt-manager/infrastructure/persistence/PersistentTagFilter";

/**
 * Configure and register all services with the DI container
 */
export function setupDependencyInjection(context: vscode.ExtensionContext) {
  // Core infrastructure
  container.registerInstance(DI_TOKENS.ExtensionContext, context);

  // File system
  container.registerSingleton(DI_TOKENS.FileSystemManager, FileSystemManager);
  container.registerSingleton(
    DI_TOKENS.ConfigurationService,
    ConfigurationService
  );

  // Data layer
  container.registerSingleton(DI_TOKENS.FileManager, FileManager);

  // Domain layer
  container.registerSingleton(DI_TOKENS.PromptRepository, PromptRepository);
  container.registerSingleton(DI_TOKENS.PromptController, PromptController);

  // Search
  container.registerSingleton(DI_TOKENS.SearchService, SearchService);

  // UI layer
  container.registerSingleton(DI_TOKENS.PromptTreeProvider, PromptTreeProvider);
  container.registerSingleton(
    DI_TOKENS.SearchPanelProvider,
    SearchPanelProvider
  );

  // Commands
  container.registerSingleton(DI_TOKENS.CommandHandler, CommandHandler);

  // Environment detection
  container.registerInstance(
    DI_TOKENS.EnvironmentDetector,
    new EnvironmentDetector(vscode.env)
  );

  // Tag services
  container.registerSingleton(DI_TOKENS.TagExtractor, TagExtractor);
  container.registerSingleton(DI_TOKENS.TagUpdater, TagUpdater);
  container.registerSingleton(DI_TOKENS.TagRepository, FileTagRepository);
  container.registerSingleton(DI_TOKENS.TagFilterState, PersistentTagFilter);
  container.registerSingleton(DI_TOKENS.TagService, TagService);
}

/**
 * Get the DI container instance (for advanced use cases)
 */
export function getContainer() {
  return container;
}

// Re-export tokens for backward compatibility
export { DI_TOKENS };

export { container };
