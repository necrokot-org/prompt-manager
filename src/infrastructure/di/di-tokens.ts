import { InjectionToken } from "tsyringe";

// Dedicated module to export unique symbols used as dependency injection tokens
// Keeping this isolated prevents circular dependencies between service classes
// and the DI container itself.
export const DI_TOKENS = {
  FileManager: Symbol("FileManager"),
  FileSystemManager: Symbol("FileSystemManager"),
  PromptRepository: Symbol("PromptRepository"),
  PromptController: Symbol("PromptController"),
  SearchService: Symbol("SearchService"),
  ConfigurationService: Symbol("ConfigurationService"),
  ExtensionContext: Symbol("ExtensionContext"),
  PromptTreeProvider: Symbol("PromptTreeProvider"),
  SearchPanelProvider: Symbol("SearchPanelProvider"),
  CommandHandler: Symbol("CommandHandler"),
  EnvironmentDetector: Symbol("EnvironmentDetector"),
  // Tag-related tokens
  TagExtractor: Symbol("TagExtractor"),
  TagUpdater: Symbol("TagUpdater"),
  TagRepository: Symbol("TagRepository"),
  TagFilterState: Symbol("TagFilterState"),
  TagService: Symbol("TagService"),
} as const;

export type DiToken<T = any> = InjectionToken<T>;
