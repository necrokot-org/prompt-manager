import "reflect-metadata";
import { container } from "tsyringe";
import * as vscode from "vscode";
import { DI_TOKENS } from "./di-tokens";
import { APP_TOKENS } from "../../application/di-tokens";

// Application layer
import { PromptApp } from "../../application/PromptApp";
import { TagApp } from "../../application/TagApp";
import { SearchApp } from "../../application/SearchApp";
import { IndexApp } from "../../application/IndexApp";

// Infrastructure layer
import { FsPromptStore } from "../prompt/FsPromptStore";
import { IndexerImpl } from "../prompt/indexing/IndexerImpl";
import { FlexSearchEngine } from "../search/FlexSearchEngine";
import { ConfigurationService } from "../config/config";
import { FileSystemManager } from "../fs/FileSystemManager";
import { EnvironmentDetector } from "../config/EnvironmentDetector";

// Filters
import {
  FilterCoordinator,
  TagPromptFilter,
  SearchPromptFilter,
} from "../../application/filters";

// Search infrastructure
import { FlexSearchService } from "../search/core/FlexSearchService";

/**
 * Configure and register all services with the DI container
 */
export function setupDependencyInjection(context: vscode.ExtensionContext) {
  // Core infrastructure
  container.registerInstance(DI_TOKENS.ExtensionContext, context);
  container.registerSingleton(DI_TOKENS.FileSystemManager, FileSystemManager);
  container.registerSingleton(
    DI_TOKENS.ConfigurationService,
    ConfigurationService
  );

  // Ports (adapters) - ConfigurationService also implements ConfigReader
  container.registerSingleton(DI_TOKENS.ConfigReader, ConfigurationService);

  // Ports (adapters)
  container.registerSingleton(DI_TOKENS.PromptStore, FsPromptStore);
  container.registerSingleton(DI_TOKENS.Indexer, IndexerImpl);
  container.registerSingleton(DI_TOKENS.SearchEngine, FlexSearchEngine);

  // Applications (use cases)
  container.registerSingleton(DI_TOKENS.PromptApp, PromptApp);
  container.registerSingleton(DI_TOKENS.TagApp, TagApp);
  container.registerSingleton(DI_TOKENS.SearchApp, SearchApp);
  container.registerSingleton(DI_TOKENS.IndexApp, IndexApp);

  // Filters
  container.registerSingleton(DI_TOKENS.TagPromptFilter, TagPromptFilter);
  container.registerSingleton(DI_TOKENS.SearchPromptFilter, SearchPromptFilter);
  container.registerSingleton(DI_TOKENS.FilterCoordinator, FilterCoordinator);

  // Register filters for multi-injection under both infra and app tokens
  container.register(DI_TOKENS.PromptFilter, {
    useToken: DI_TOKENS.TagPromptFilter,
  });
  container.register(DI_TOKENS.PromptFilter, {
    useToken: DI_TOKENS.SearchPromptFilter,
  });

  // Multi-injection under app token (for FilterCoordinator)
  container.register(APP_TOKENS.PromptFilter, {
    useToken: DI_TOKENS.TagPromptFilter,
  });
  container.register(APP_TOKENS.PromptFilter, {
    useToken: DI_TOKENS.SearchPromptFilter,
  });

  // Search infrastructure
  container.registerSingleton(DI_TOKENS.FlexSearchService, FlexSearchService);

  // Environment detection
  container.registerInstance(
    DI_TOKENS.EnvironmentDetector,
    new EnvironmentDetector(vscode.env)
  );
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
