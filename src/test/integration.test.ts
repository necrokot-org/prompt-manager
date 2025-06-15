import * as assert from "assert";
import * as vscode from "vscode";
import { PromptController } from "../promptController";
import { PromptTreeProvider } from "../promptTreeProvider";
import { SearchPanelProvider, SearchCriteria } from "../searchPanelProvider";
import { FileManager } from "../fileManager";
import { PromptRepository } from "../promptRepository";
import { subscribe, publish } from "../core/eventBus";

suite("Integration Tests", () => {
  let controller: PromptController;
  let treeProvider: PromptTreeProvider;
  let searchProvider: SearchPanelProvider;
  let fileManager: FileManager;
  let repository: PromptRepository;
  let mockExtensionUri: vscode.Uri;

  setup(async () => {
    // Create mock extension URI
    mockExtensionUri = vscode.Uri.file("/test/extension");

    // Initialize components using new API
    fileManager = new FileManager();
    repository = new PromptRepository(fileManager);
    controller = new PromptController(repository);
    treeProvider = new PromptTreeProvider(controller);
    searchProvider = new SearchPanelProvider(mockExtensionUri);

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
