import * as assert from "assert";
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { PromptController } from "../promptController";
import { PromptTreeProvider } from "../promptTreeProvider";
import { SearchPanelProvider, SearchCriteria } from "../searchPanelProvider";
import { PromptRepository } from "../promptRepository";
import { FileManager } from "../fileManager";
import { ExtensionEventBus } from "../core/EventSystem";
import {
  createMockExtensionUri,
  createTempDirectory,
  cleanupTempDirectory,
} from "./helpers";

suite("Integration Tests", () => {
  let tempDir: string;
  let mockExtensionUri: vscode.Uri;
  let eventBus: ExtensionEventBus;
  let fileManager: FileManager;
  let repository: PromptRepository;
  let controller: PromptController;
  let treeProvider: PromptTreeProvider;
  let searchProvider: SearchPanelProvider;

  suiteSetup(async () => {
    tempDir = await createTempDirectory();
    mockExtensionUri = createMockExtensionUri();
  });

  suiteTeardown(async () => {
    await cleanupTempDirectory(tempDir);
  });

  setup(() => {
    // Initialize event bus first
    eventBus = new ExtensionEventBus();

    // Initialize components with event bus
    fileManager = new FileManager(eventBus);
    repository = new PromptRepository(eventBus, fileManager);
    controller = new PromptController(eventBus, repository);
    treeProvider = new PromptTreeProvider(controller, eventBus);
    searchProvider = new SearchPanelProvider(mockExtensionUri, eventBus);
  });

  teardown(() => {
    // Clean up event bus and components
    if (treeProvider) {
      treeProvider.dispose();
    }
    if (controller) {
      controller.dispose();
    }
    if (repository) {
      repository.dispose();
    }
    if (eventBus) {
      eventBus.dispose();
    }
  });

  test("End-to-End Prompt Creation and Tree Display", async () => {
    // Mock workspace folder
    const workspaceFolder: vscode.WorkspaceFolder = {
      uri: vscode.Uri.file(tempDir),
      name: "test-workspace",
      index: 0,
    };

    // Override workspace folders for this test
    const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
    Object.defineProperty(vscode.workspace, "workspaceFolders", {
      value: [workspaceFolder],
      configurable: true,
    });

    try {
      // Initialize repository
      const initialized = await repository.initialize();
      assert.ok(initialized, "Repository should initialize successfully");

      // Create a test prompt
      const promptPath = await repository.createPromptFile(
        "Test Prompt",
        undefined
      );
      assert.ok(promptPath, "Prompt file should be created");
      assert.ok(fs.existsSync(promptPath!), "Prompt file should exist on disk");

      // Get prompt structure
      const structure = await controller.getPromptStructure();
      assert.strictEqual(
        structure.rootPrompts.length,
        1,
        "Should have one root prompt"
      );
      assert.strictEqual(
        structure.rootPrompts[0].title,
        "Test Prompt",
        "Prompt should have correct title"
      );

      // Get tree items
      const rootItems = await treeProvider.getChildren();
      assert.ok(rootItems.length > 0, "Tree should have items");

      // Verify the prompt appears in the tree
      const promptItems = rootItems.filter(
        (item) => item.label === "Test Prompt"
      );
      assert.strictEqual(
        promptItems.length,
        1,
        "Prompt should appear in tree view"
      );
    } finally {
      // Restore original workspace folders
      Object.defineProperty(vscode.workspace, "workspaceFolders", {
        value: originalWorkspaceFolders,
        configurable: true,
      });
    }
  });

  test("Search Integration with Tree Filtering", async function () {
    this.timeout(10000); // Increase timeout for async operations

    // Mock workspace folder
    const workspaceFolder: vscode.WorkspaceFolder = {
      uri: vscode.Uri.file(tempDir),
      name: "test-workspace",
      index: 0,
    };

    const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
    Object.defineProperty(vscode.workspace, "workspaceFolders", {
      value: [workspaceFolder],
      configurable: true,
    });

    try {
      await repository.initialize();

      // Create multiple test prompts
      await repository.createPromptFile("JavaScript Helper", undefined);
      await repository.createPromptFile("Python Guide", undefined);
      await repository.createPromptFile("Code Review", undefined);

      // Wait a bit for file operations to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Test search criteria event publishing
      let searchEventReceived = false;
      eventBus.subscribe("search.criteria.changed", (event) => {
        searchEventReceived = true;
        const searchEvent = event as any;
        assert.strictEqual(searchEvent.payload.query, "JavaScript");
        assert.strictEqual(searchEvent.payload.isActive, true);
      });

      // Simulate search via the search provider
      const searchCriteria: SearchCriteria = {
        query: "JavaScript",
        scope: "both",
        caseSensitive: false,
        isActive: true,
      };

      // Manually trigger search criteria change event
      eventBus.publishSync({
        type: "search.criteria.changed",
        source: "IntegrationTest",
        payload: searchCriteria,
      });

      // Wait for event processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      assert.ok(searchEventReceived, "Search event should be received");

      // Test tree filtering with search criteria
      treeProvider.setSearchCriteria(searchCriteria);
      const filteredItems = await treeProvider.getChildren();

      // Should only show items matching "JavaScript"
      const hasJavaScriptItem = filteredItems.some((item) => {
        const label =
          typeof item.label === "string" ? item.label : item.label?.label || "";
        return label.includes("JavaScript");
      });
      assert.ok(hasJavaScriptItem, "Should find JavaScript-related prompts");

      // Clear search and verify all items return
      treeProvider.setSearchCriteria(null);
      const allItems = await treeProvider.getChildren();
      assert.ok(
        allItems.length >= 3,
        "Should show all prompts when search is cleared"
      );
    } finally {
      Object.defineProperty(vscode.workspace, "workspaceFolders", {
        value: originalWorkspaceFolders,
        configurable: true,
      });
    }
  });

  test("Folder Creation and Organization", async () => {
    const workspaceFolder: vscode.WorkspaceFolder = {
      uri: vscode.Uri.file(tempDir),
      name: "test-workspace",
      index: 0,
    };

    const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
    Object.defineProperty(vscode.workspace, "workspaceFolders", {
      value: [workspaceFolder],
      configurable: true,
    });

    try {
      await repository.initialize();

      // Create a folder
      const folderPath = await repository.createFolder("Test Category");
      assert.ok(folderPath, "Folder should be created");
      assert.ok(fs.existsSync(folderPath!), "Folder should exist on disk");

      // Create a prompt in the folder
      const promptPath = await repository.createPromptFile(
        "Categorized Prompt",
        folderPath!
      );
      assert.ok(promptPath, "Prompt should be created in folder");

      // Verify structure
      const structure = await controller.getPromptStructure();
      assert.strictEqual(structure.folders.length, 1, "Should have one folder");
      assert.strictEqual(
        structure.folders[0].name,
        "Test Category",
        "Folder should have correct name"
      );
      assert.strictEqual(
        structure.folders[0].prompts.length,
        1,
        "Folder should contain one prompt"
      );
      assert.strictEqual(
        structure.folders[0].prompts[0].title,
        "Categorized Prompt",
        "Prompt should have correct title"
      );

      // Verify tree structure
      const rootItems = await treeProvider.getChildren();
      const folderItems = rootItems.filter(
        (item) => item.contextValue === "promptFolder"
      );
      assert.strictEqual(
        folderItems.length,
        1,
        "Should have one folder in tree"
      );
    } finally {
      Object.defineProperty(vscode.workspace, "workspaceFolders", {
        value: originalWorkspaceFolders,
        configurable: true,
      });
    }
  });

  test("Event Bus Communication Between Components", async () => {
    let fileCreatedEvents = 0;
    let directoryCreatedEvents = 0;
    let structureChangedEvents = 0;

    // Subscribe to various filesystem events
    eventBus.subscribe("filesystem.file.created", () => {
      fileCreatedEvents++;
    });

    eventBus.subscribe("filesystem.directory.created", () => {
      directoryCreatedEvents++;
    });

    eventBus.subscribe("filesystem.structure.changed", () => {
      structureChangedEvents++;
    });

    const workspaceFolder: vscode.WorkspaceFolder = {
      uri: vscode.Uri.file(tempDir),
      name: "test-workspace",
      index: 0,
    };

    const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
    Object.defineProperty(vscode.workspace, "workspaceFolders", {
      value: [workspaceFolder],
      configurable: true,
    });

    try {
      await repository.initialize();

      // Create folder and file to trigger events
      await repository.createFolder("Events Test");
      await repository.createPromptFile("Event Test Prompt", undefined);

      // Wait for events to propagate
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify events were published
      assert.ok(
        fileCreatedEvents > 0,
        "File created events should be published"
      );
      assert.ok(
        directoryCreatedEvents > 0,
        "Directory created events should be published"
      );
      assert.ok(
        structureChangedEvents > 0,
        "Structure changed events should be published"
      );

      // Test event bus statistics
      const stats = eventBus.getStats();
      assert.ok(stats.subscriberCount > 0, "Should have active subscribers");
      assert.ok(
        stats.eventTypes.length > 0,
        "Should have registered event types"
      );
    } finally {
      Object.defineProperty(vscode.workspace, "workspaceFolders", {
        value: originalWorkspaceFolders,
        configurable: true,
      });
    }
  });

  test("Component Disposal and Cleanup", () => {
    // Test that all components properly dispose of their resources
    const initialStats = eventBus.getStats();

    // Dispose components
    treeProvider.dispose();
    controller.dispose();
    repository.dispose();

    // Verify cleanup (event bus should have fewer subscribers)
    const finalStats = eventBus.getStats();
    assert.ok(
      finalStats.subscriberCount <= initialStats.subscriberCount,
      "Subscriber count should not increase after disposal"
    );

    // Event bus should still be functional
    assert.ok(!eventBus["isDisposed"], "Event bus should not be disposed yet");
  });
});
