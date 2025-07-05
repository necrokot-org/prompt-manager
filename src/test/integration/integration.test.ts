import "reflect-metadata";
import * as assert from "assert";
import * as vscode from "vscode";
import { PromptController } from "@features/prompt-manager/domain/promptController";
import { PromptTreeProvider } from "@features/prompt-manager/ui/tree/PromptTreeProvider";
import { SearchPanelProvider } from "@features/search/ui/SearchPanelProvider";
import { SearchCriteria } from "@features/search/types/SearchCriteria";
import { FileManager } from "@features/prompt-manager/data/fileManager";
import { PromptRepository } from "@features/prompt-manager/domain/promptRepository";
import { eventBus } from "@infra/vscode/ExtensionBus";
import { setupDependencyInjection, container } from "@infra/di/di-container";

import { DI_TOKENS } from "@infra/di/di-tokens";
import { SearchScope } from "@features/search/core/FlexSearchService";

suite("Integration Tests", () => {
  let controller: PromptController;
  let treeProvider: PromptTreeProvider;
  let searchProvider: SearchPanelProvider;
  let fileManager: FileManager;
  let repository: PromptRepository;
  let mockContext: vscode.ExtensionContext;

  setup(async () => {
    // Create mock extension context
    mockContext = {
      extensionUri: vscode.Uri.file("/test/extension"),
      subscriptions: [],
      workspaceState: {
        get: () => undefined,
        update: () => Promise.resolve(),
      } as any,
      globalState: {
        get: () => undefined,
        update: () => Promise.resolve(),
      } as any,
      secrets: {} as any,
      extensionMode: vscode.ExtensionMode.Test,
      extension: {} as any,
      storageUri: vscode.Uri.file("/test/storage"),
      globalStorageUri: vscode.Uri.file("/test/globalStorage"),
      logUri: vscode.Uri.file("/test/log"),
      environmentVariableCollection: {} as any,
      extensionPath: "/test/extension",
      asAbsolutePath: (path: string) => path,
      storagePath: "/test/storage",
      globalStoragePath: "/test/globalStorage",
      logPath: "/test/log",
      languageModelAccessInformation: {} as any,
    };

    // Configure DI container with mock context
    setupDependencyInjection(mockContext);

    // Resolve services from DI container
    fileManager = container.resolve<FileManager>(DI_TOKENS.FileManager);
    repository = container.resolve<PromptRepository>(
      DI_TOKENS.PromptRepository
    );
    controller = container.resolve<PromptController>(
      DI_TOKENS.PromptController
    );
    treeProvider = container.resolve<PromptTreeProvider>(
      DI_TOKENS.PromptTreeProvider
    );
    searchProvider = container.resolve<SearchPanelProvider>(
      DI_TOKENS.SearchPanelProvider
    );

    // Initialize controller
    await controller.initialize();
  });

  teardown(() => {
    // Clean up components
    if (treeProvider) {
      treeProvider.dispose();
    }
    if (controller) {
      controller.dispose();
    }
    // Clean up DI container
    container.clearInstances();
  });

  test("should initialize all components correctly", () => {
    assert.ok(controller, "Controller should be initialized");
    assert.ok(treeProvider, "Tree provider should be initialized");
    assert.ok(searchProvider, "Search provider should be initialized");
    assert.ok(fileManager, "File manager should be initialized");
    assert.ok(repository, "Repository should be initialized");
  });

  test("should handle search events correctly", (done) => {
    let eventReceived = false;

    // Listen to search events
    eventBus.on("search.criteria.changed", (payload) => {
      eventReceived = true;
      assert.strictEqual(payload.query, "test query");
      assert.strictEqual(payload.scope, SearchScope.ALL);
      assert.strictEqual(payload.caseSensitive, false);
      assert.strictEqual(payload.isActive, true);
      done();
    });

    // Emit a search event
    eventBus.emit("search.criteria.changed", {
      query: "test query",
      scope: SearchScope.ALL,
      caseSensitive: false,
      fuzzy: undefined,
      matchWholeWord: false,
      isActive: true,
    });

    // Timeout fallback
    setTimeout(() => {
      if (!eventReceived) {
        done(new Error("Search event was not received"));
      }
    }, 1000);
  });
});
