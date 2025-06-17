import "reflect-metadata";
import { container, InjectionToken } from "tsyringe";
import * as vscode from "vscode";
import { DI_TOKENS } from "./di-tokens";

// Import all services that need to be managed by DI
import { FileManager } from "../fileManager";
import { PromptRepository } from "../promptRepository";
import { PromptController } from "../promptController";
import { SearchService } from "../searchService";
import { ConfigurationService } from "../config";
import { PromptTreeProvider } from "../promptTreeProvider";
import { SearchPanelProvider } from "../searchPanelProvider";
import { CommandHandler } from "../commandHandler";

/**
 * Configure and register all services with the DI container
 */
export function configureDependencies(context: vscode.ExtensionContext): void {
  // Register the extension context first since other services may need it
  container.registerInstance(DI_TOKENS.ExtensionContext, context);

  // Register core services as singletons to ensure single instances across the app
  container.registerSingleton(DI_TOKENS.FileManager, FileManager);
  container.registerSingleton(
    DI_TOKENS.ConfigurationService,
    ConfigurationService
  );

  // Register business logic services
  container.registerSingleton(DI_TOKENS.PromptRepository, PromptRepository);
  container.registerSingleton(DI_TOKENS.PromptController, PromptController);
  container.registerSingleton(DI_TOKENS.SearchService, SearchService);

  // Register UI services
  container.registerSingleton(DI_TOKENS.PromptTreeProvider, PromptTreeProvider);
  container.registerSingleton(
    DI_TOKENS.SearchPanelProvider,
    SearchPanelProvider
  );
  container.registerSingleton(DI_TOKENS.CommandHandler, CommandHandler);

  console.log("Dependency injection container configured successfully");
}

/**
 * Resolve a service from the DI container
 */
export function resolve<T>(token: InjectionToken<T>): T {
  return container.resolve<T>(token);
}

/**
 * Clean up the DI container and dispose all singletons
 */
export function disposeDependencies(): void {
  container.clearInstances();
  console.log("Dependency injection container cleared");
}

/**
 * Get the DI container instance (for advanced use cases)
 */
export function getContainer() {
  return container;
}

// Re-export tokens for backward compatibility
export { DI_TOKENS };
