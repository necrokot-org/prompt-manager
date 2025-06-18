import "reflect-metadata";
import * as assert from "assert";
import * as vscode from "vscode";
import { PromptController } from "@features/prompt-manager/domain/promptController";
import { PromptTreeProvider } from "@features/prompt-manager/ui/tree/PromptTreeProvider";
import {
  SearchPanelProvider,
  SearchCriteria,
} from "@features/search/ui/SearchPanelProvider";
import { FileManager } from "@features/prompt-manager/data/fileManager";
import { PromptRepository } from "@features/prompt-manager/domain/promptRepository";
import { eventBus } from "@infra/vscode/ExtensionBus";
import {
  configureDependencies,
  resolve,
  disposeDependencies,
} from "@infra/di/di-container";

import { DI_TOKENS } from "@infra/di/di-tokens";

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
      workspaceState: {} as any,
      globalState: {} as any,
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
    configureDependencies(mockContext);

    // Resolve services from DI container
    fileManager = resolve<FileManager>(DI_TOKENS.FileManager);
    repository = resolve<PromptRepository>(DI_TOKENS.PromptRepository);
    controller = resolve<PromptController>(DI_TOKENS.PromptController);
    treeProvider = resolve<PromptTreeProvider>(DI_TOKENS.PromptTreeProvider);
    searchProvider = resolve<SearchPanelProvider>(
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
    disposeDependencies();
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
      assert.strictEqual(payload.scope, "both");
      assert.strictEqual(payload.caseSensitive, false);
      assert.strictEqual(payload.isActive, true);
      done();
    });

    // Emit a search event
    eventBus.emit("search.criteria.changed", {
      query: "test query",
      scope: "both",
      caseSensitive: false,
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
