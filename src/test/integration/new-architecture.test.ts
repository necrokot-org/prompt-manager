import "reflect-metadata";
import * as assert from "assert";
import * as vscode from "vscode";
import { PromptApp } from "../../application/PromptApp";
import { TagApp } from "../../application/TagApp";
import { SearchApp } from "../../application/SearchApp";
import { IndexApp } from "../../application/IndexApp";
import {
  setupDependencyInjection,
  container,
} from "../../infrastructure/di/di-container";
import { DI_TOKENS } from "../../infrastructure/di/di-tokens";
import { SearchQuery } from "../../domain/model/SearchQuery";
import { Tag } from "../../domain/model/Tag";
import { setupMockWorkspace, MockWorkspaceSetup } from "./helpers";

suite("New Architecture Integration Tests", () => {
  let promptApp: PromptApp;
  let tagApp: TagApp;
  let searchApp: SearchApp;
  let indexApp: IndexApp;
  let mockWorkspace: MockWorkspaceSetup;
  let mockContext: vscode.ExtensionContext;

  setup(async () => {
    // Clear DI container first to avoid test interference
    container.clearInstances();

    // Setup test environment with mock workspace
    mockWorkspace = await setupMockWorkspace("new-arch-test-");

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
      storagePath: "/test/storage",
      globalStoragePath: "/test/globalStorage",
      logPath: "/test/log",
      asAbsolutePath: (path: string) => path,
      languageModelAccessInformation: {} as any,
    };

    // Configure DI container with mock context
    setupDependencyInjection(mockContext);

    // Resolve new application services
    promptApp = container.resolve<PromptApp>(DI_TOKENS.PromptApp);
    tagApp = container.resolve<TagApp>(DI_TOKENS.TagApp);
    searchApp = container.resolve<SearchApp>(DI_TOKENS.SearchApp);
    indexApp = container.resolve<IndexApp>(DI_TOKENS.IndexApp);

    // Initialize workspace
    await promptApp.initWorkspace();
  });

  teardown(async () => {
    // Clean up DI container
    container.clearInstances();

    // Clean up mock workspace
    await mockWorkspace.cleanup();
  });

  test("should initialize all new application services correctly", () => {
    assert.ok(promptApp, "PromptApp should be initialized");
    assert.ok(tagApp, "TagApp should be initialized");
    assert.ok(searchApp, "SearchApp should be initialized");
    assert.ok(indexApp, "IndexApp should be initialized");
  });

  test("should create and manage prompts through PromptApp", async () => {
    // Create a prompt
    const promptPath = await promptApp.createPrompt("Test Prompt");

    assert.ok(promptPath, "Should create a prompt and return a path");
    assert.strictEqual(
      typeof promptPath,
      "string",
      "Prompt path should be a string"
    );

    // Get the structure to verify the prompt was created
    const structure = await promptApp.structure();
    assert.ok(structure, "Should get prompt structure");

    // Clean up - delete the prompt
    await promptApp.deletePrompt(promptPath);
  });

  test("should manage tags through TagApp", async () => {
    // Create a prompt with tags first
    const promptPath = await promptApp.createPrompt("Tagged Prompt", undefined);

    // Test tag operations
    const tags = await tagApp.list();
    assert.ok(Array.isArray(tags), "Should return an array of tags");

    // Test selecting a tag
    if (tags.length > 0) {
      tagApp.select(tags[0]);
      const activeTag = tagApp.getActiveTag();
      assert.ok(activeTag, "Should have an active tag");
      assert.ok(
        activeTag!.equals(tags[0]),
        "Active tag should match selected tag"
      );

      // Test clearing tag
      tagApp.clear();
      assert.ok(!tagApp.getActiveTag(), "Should clear active tag");
    }

    // Clean up
    await promptApp.deletePrompt(promptPath);
  });

  test("should handle search through SearchApp", async () => {
    // Create a prompt to search
    const promptPath = await promptApp.createPrompt("Searchable Prompt");

    // Test search criteria setting
    const searchQuery: SearchQuery = {
      query: "Searchable",
      scope: "both",
      caseSensitive: false,
      isActive: true,
    };

    await searchApp.setCriteria(searchQuery);
    const currentQuery = searchApp.getCurrentQuery();
    assert.ok(currentQuery, "Should have current search query");
    assert.strictEqual(currentQuery!.query, "Searchable", "Query should match");

    // Test search results
    const results = searchApp.getResults();
    assert.ok(Array.isArray(results), "Should return search results array");

    // Test clearing search
    searchApp.clear();
    assert.ok(!searchApp.getCurrentQuery(), "Should clear search query");
    assert.strictEqual(
      searchApp.getResultsCount(),
      0,
      "Should have no results after clear"
    );

    // Clean up
    await promptApp.deletePrompt(promptPath);
  });

  test("should handle indexing through IndexApp", async () => {
    // Test rebuild
    await indexApp.rebuild();
    assert.ok(true, "Should rebuild index without error");

    // Test rebuildNow
    await indexApp.rebuildNow();
    assert.ok(true, "Should rebuild index immediately without error");
  });

  test("should integrate PromptApp and TagApp events", async () => {
    let treeChangedCount = 0;
    let tagsChangedCount = 0;

    // Listen to events
    const treeSubscription = promptApp.onTreeChanged(() => {
      treeChangedCount++;
    });

    const tagsSubscription = tagApp.onTagsChanged(() => {
      tagsChangedCount++;
    });

    // Create a prompt - should trigger tree change
    const promptPath = await promptApp.createPrompt("Event Test Prompt");

    // Wait a bit for events to propagate
    await new Promise((resolve) => setTimeout(resolve, 100));

    assert.ok(treeChangedCount > 0, "Should have received tree changed events");

    // Clean up
    treeSubscription.dispose();
    tagsSubscription.dispose();
    await promptApp.deletePrompt(promptPath);
  });

  test("should handle folder operations through PromptApp", async () => {
    // Create a folder
    const folderPath = await promptApp.createFolder("Test Folder");

    assert.ok(folderPath, "Should create a folder and return a path");
    assert.strictEqual(
      typeof folderPath,
      "string",
      "Folder path should be a string"
    );

    // Create a prompt in the folder
    const promptPath = await promptApp.createPrompt(
      "Prompt in Folder",
      folderPath
    );

    // Get structure to verify both folder and prompt exist
    const structure = await promptApp.structure();
    assert.ok(structure.folders.length > 0, "Should have folders in structure");

    const folder = structure.folders.find((f) => f.path === folderPath);
    assert.ok(folder, "Should find the created folder");
    assert.ok(folder!.prompts.length > 0, "Folder should contain prompts");

    // Clean up
    await promptApp.deletePrompt(promptPath);
    await promptApp.deleteFolder(folderPath);
  });
});
