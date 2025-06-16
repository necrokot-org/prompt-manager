import "reflect-metadata";
import * as assert from "assert";
import * as vscode from "vscode";
import { PromptController } from "../promptController";
import { PromptTreeProvider } from "../promptTreeProvider";
import { SearchPanelProvider, SearchCriteria } from "../searchPanelProvider";
import { FileManager } from "../fileManager";
import { PromptRepository } from "../promptRepository";
import { subscribe, publish } from "../core/eventBus";
import {
  configureDependencies,
  resolve,
  disposeDependencies,
  DI_TOKENS,
} from "../core/di-container";

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

    // Subscribe to search events
    subscribe("search.criteria.changed", (event: any) => {
      eventReceived = true;
      assert.strictEqual(event.payload.query, "test query");
      assert.strictEqual(event.payload.scope, "both");
      assert.strictEqual(event.payload.caseSensitive, false);
      assert.strictEqual(event.payload.isActive, true);
      done();
    });

    // Publish a search event
    publish({
      type: "search.criteria.changed",
      source: "test",
      payload: {
        query: "test query",
        scope: "both" as const,
        caseSensitive: false,
        isActive: true,
      },
    });

    // Timeout fallback
    setTimeout(() => {
      if (!eventReceived) {
        done(new Error("Search event was not received"));
      }
    }, 1000);
  });
});
