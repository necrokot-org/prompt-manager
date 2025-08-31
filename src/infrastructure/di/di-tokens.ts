import { InjectionToken } from "tsyringe";

// Dedicated module to export unique symbols used as dependency injection tokens
// Keeping this isolated prevents circular dependencies between service classes
// and the DI container itself.
export const DI_TOKENS = {
  // Core infrastructure
  FileSystemManager: Symbol("FileSystemManager"),
  ConfigurationService: Symbol("ConfigurationService"),
  ExtensionContext: Symbol("ExtensionContext"),
  EnvironmentDetector: Symbol("EnvironmentDetector"),

  // Ports (interfaces)
  PromptStore: Symbol("PromptStore"),
  Indexer: Symbol("Indexer"),
  SearchEngine: Symbol("SearchEngine"),
  ConfigReader: Symbol("ConfigReader"),

  // Applications (use cases)
  PromptApp: Symbol("PromptApp"),
  TagApp: Symbol("TagApp"),
  SearchApp: Symbol("SearchApp"),
  IndexApp: Symbol("IndexApp"),

  // Filters
  PromptFilter: Symbol("PromptFilter"),
  FilterCoordinator: Symbol("FilterCoordinator"),
  TagPromptFilter: Symbol("TagPromptFilter"),
  SearchPromptFilter: Symbol("SearchPromptFilter"),

  // Search infrastructure
  FlexSearchService: Symbol("FlexSearchService"),
} as const;

export type DiToken<T = any> = InjectionToken<T>;
