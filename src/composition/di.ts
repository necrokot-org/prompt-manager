// src/composition/di.ts
import "reflect-metadata";
import * as vscode from "vscode";
import {
  setupDependencyInjection,
  container,
  DI_TOKENS,
} from "../infrastructure/di/di-container";
import { ConfigurationService } from "../infrastructure/config/config";
import { PromptApp } from "../application/PromptApp";
import { TagApp } from "../application/TagApp";
import { SearchApp } from "../application/SearchApp";
import { IndexApp } from "../application/IndexApp";
import { ConfigReader } from "../application/ports/ConfigReader";
import { EnvironmentDetector } from "../infrastructure/config/EnvironmentDetector";

export interface Services {
  promptApp: PromptApp;
  tagApp: TagApp;
  searchApp: SearchApp;
  indexApp: IndexApp;
  config: ConfigReader;
  env: EnvironmentDetector;
}

export function setup(context: vscode.ExtensionContext): Services {
  setupDependencyInjection(context);

  // Initialize infra-only services here, not in presentation
  const configService = container.resolve<ConfigurationService>(
    DI_TOKENS.ConfigurationService
  );
  configService.initialize();

  return {
    promptApp: container.resolve<PromptApp>(DI_TOKENS.PromptApp),
    tagApp: container.resolve<TagApp>(DI_TOKENS.TagApp),
    searchApp: container.resolve<SearchApp>(DI_TOKENS.SearchApp),
    indexApp: container.resolve<IndexApp>(DI_TOKENS.IndexApp),
    config: container.resolve<ConfigReader>(DI_TOKENS.ConfigReader),
    env: container.resolve<EnvironmentDetector>(DI_TOKENS.EnvironmentDetector),
  };
}

export function dispose(): void {
  // optional: add any needed cleanup
  container.clearInstances();
}
