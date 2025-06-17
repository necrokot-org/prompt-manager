import * as assert from "assert";
import * as vscode from "vscode";
import {
  PromptTreeProvider,
  PromptTreeItem,
  FileTreeItem,
  FolderTreeItem,
} from "../promptTreeProvider";
import { PromptController } from "../promptController";
import { SearchService } from "../searchService";
import { SearchCriteria } from "../searchPanelProvider";
import { PromptFile, PromptFolder } from "../fileManager";

suite("PromptTreeProvider Tests", () => {
  let treeProvider: PromptTreeProvider;
  let mockPromptController: PromptController;
  let mockSearchService: SearchService;

  const createMockPromptFile = (
    name: string,
    title: string,
    path: string,
    tags: string[] = [],
    description?: string
  ): PromptFile => ({
    name,
    title,
    path,
    description,
    tags,
    fileSize: 1024,
    isDirectory: false,
  });

  const createMockPromptFolder = (
    name: string,
    path: string,
    prompts: PromptFile[]
  ): PromptFolder => ({
    name,
    path,
    prompts,
  });

  suiteSetup(() => {
    // Create mock prompt files
    const testPrompts: PromptFile[] = [
      createMockPromptFile(
        "test1.md",
        "JavaScript Prompt",
        "/path/test1.md",
        ["javascript", "code"],
        "A JavaScript prompt"
      ),
      createMockPromptFile(
        "test2.md",
        "Python Script",
        "/path/test2.md",
        ["python", "script"],
        "Python automation script"
      ),
      createMockPromptFile(
        "test3.md",
        "Database Query",
        "/path/test3.md",
        ["sql", "database"],
        "SQL query helper"
      ),
    ];

    const folderPrompts: PromptFile[] = [
      createMockPromptFile(
        "folder1.md",
        "Folder Prompt 1",
        "/path/folder/folder1.md",
        ["nested"],
        "Inside folder"
      ),
      createMockPromptFile(
        "folder2.md",
        "API Documentation",
        "/path/folder/folder2.md",
        ["api", "docs"],
        "API docs"
      ),
    ];

    const testFolders: PromptFolder[] = [
      createMockPromptFolder("TestFolder", "/path/folder", folderPrompts),
    ];

    // Mock PromptController
    mockPromptController = {
      getPromptStructure: async () => ({
        folders: testFolders,
        rootPrompts: testPrompts,
      }),
      onDidChangeTreeData: () => ({ dispose: () => {} }),
      // Add other required methods as empty mocks
      refreshPrompts: async () => {},
      openPrompt: async () => {},
      createPrompt: async () => "",
      createFolder: async () => "",
      deletePrompt: async () => false,
      copyPromptContent: async () => false,
    } as any;

    // Mock SearchService
    mockSearchService = {
      search: async () => [],
      searchInContent: async () => [],
      searchInTitle: async () => [],
      searchBoth: async () => [],
      matchesPrompt: async () => false,
      countMatches: async () => 0,
      clearCache: () => {},
      getAvailableScopes: () => ["titles", "content", "both"],
      publishResultsUpdated: async () => {},
      publishCleared: async () => {},
    } as any;

    treeProvider = new PromptTreeProvider(
      mockPromptController,
      mockSearchService
    );
  });

  test("Initial Tree State - No Search", async () => {
    const rootItems = await treeProvider.getChildren();

    // Should have 1 folder + 3 root prompts
    assert.ok(rootItems.length >= 4);

    // Check folder item
    const folderItem = rootItems.find((item) => item instanceof FolderTreeItem);
    assert.ok(folderItem);
    assert.strictEqual(folderItem?.label, "TestFolder");

    // Check root prompt items
    const promptItems = rootItems.filter(
      (item) => item instanceof FileTreeItem
    );
    assert.ok(promptItems.length >= 3);
  });

  test("Tree Item Creation - Prompt File", async () => {
    const rootItems = await treeProvider.getChildren();
    const promptItem = rootItems.find(
      (item) =>
        item instanceof FileTreeItem &&
        item.promptFile?.title === "JavaScript Prompt"
    );

    assert.ok(promptItem);
    assert.strictEqual(promptItem.label, "JavaScript Prompt");
    assert.strictEqual(
      promptItem.collapsibleState,
      vscode.TreeItemCollapsibleState.None
    );
    assert.ok(promptItem.command);
    assert.strictEqual(promptItem.command.command, "promptManager.openPrompt");
  });

  test("Tree Item Creation - Folder", async () => {
    const rootItems = await treeProvider.getChildren();
    const folderItem = rootItems.find((item) => item instanceof FolderTreeItem);

    assert.ok(folderItem);
    assert.strictEqual(folderItem.label, "TestFolder");
    assert.strictEqual(
      folderItem.collapsibleState,
      vscode.TreeItemCollapsibleState.Expanded
    );
    assert.ok(!folderItem.command); // Folders shouldn't have commands
  });

  test("Folder Children Retrieval", async () => {
    const rootItems = await treeProvider.getChildren();
    const folderItem = rootItems.find((item) => item instanceof FolderTreeItem);

    assert.ok(folderItem);

    const folderChildren = await treeProvider.getChildren(folderItem);
    assert.strictEqual(folderChildren.length, 2);

    const childTitles = folderChildren.map((child) => child.label);
    assert.ok(childTitles.includes("Folder Prompt 1"));
    assert.ok(childTitles.includes("API Documentation"));
  });

  test("Search Criteria Application", () => {
    const searchCriteria: SearchCriteria = {
      query: "javascript",
      scope: "both",
      caseSensitive: false,
      isActive: true,
    };

    treeProvider.setSearchCriteria(searchCriteria);
    const currentCriteria = treeProvider.getCurrentSearchCriteria();

    assert.ok(currentCriteria);
    assert.strictEqual(currentCriteria.query, "javascript");
    assert.strictEqual(currentCriteria.scope, "both");
    assert.strictEqual(currentCriteria.caseSensitive, false);
    assert.strictEqual(currentCriteria.isActive, true);
  });

  test("Search Criteria Clearing", () => {
    // First set search criteria
    const searchCriteria: SearchCriteria = {
      query: "test",
      scope: "titles",
      caseSensitive: true,
      isActive: true,
    };
    treeProvider.setSearchCriteria(searchCriteria);

    // Then clear it
    treeProvider.setSearchCriteria(null);
    const currentCriteria = treeProvider.getCurrentSearchCriteria();

    assert.strictEqual(currentCriteria, null);
  });

  test("Tree Refresh Event", (done) => {
    let refreshCalled = false;

    const disposable = treeProvider.onDidChangeTreeData(() => {
      refreshCalled = true;
      disposable.dispose();
      done();
    });

    treeProvider.refresh();

    // Should trigger event
    setTimeout(() => {
      assert.ok(refreshCalled);
    }, 10);
  });

  test("Tree Item Context Values", async () => {
    const rootItems = await treeProvider.getChildren();

    const promptItem = rootItems.find((item) => item instanceof FileTreeItem);
    const folderItem = rootItems.find((item) => item instanceof FolderTreeItem);

    assert.ok(promptItem);
    assert.ok(folderItem);

    // Check context values for menu contributions
    assert.strictEqual(promptItem.contextValue, "promptFile");
    assert.strictEqual(folderItem.contextValue, "promptFolder");
  });

  test("Tree Item Icons", async () => {
    const rootItems = await treeProvider.getChildren();

    const promptItem = rootItems.find((item) => item instanceof FileTreeItem);
    const folderItem = rootItems.find((item) => item instanceof FolderTreeItem);

    assert.ok(promptItem);
    assert.ok(folderItem);

    assert.ok(promptItem.iconPath);
    assert.ok(folderItem.iconPath);

    // Should use theme icons
    assert.ok((promptItem.iconPath as vscode.ThemeIcon).id);
    assert.ok((folderItem.iconPath as vscode.ThemeIcon).id);
  });

  test("Tree Item Tooltips", async () => {
    const rootItems = await treeProvider.getChildren();

    const promptItem = rootItems.find(
      (item) =>
        item instanceof FileTreeItem &&
        item.promptFile?.title === "JavaScript Prompt"
    );

    assert.ok(promptItem);
    assert.ok(promptItem.tooltip);
    assert.ok((promptItem.tooltip as string).includes("JavaScript Prompt"));
    assert.ok((promptItem.tooltip as string).includes("javascript"));
  });

  test("Tree Item Descriptions", async () => {
    const rootItems = await treeProvider.getChildren();

    const promptItem = rootItems.find(
      (item) =>
        item instanceof FileTreeItem &&
        item.promptFile?.title === "JavaScript Prompt"
    );
    const folderItem = rootItems.find((item) => item instanceof FolderTreeItem);

    assert.ok(promptItem);
    assert.ok(folderItem);

    // Prompt should have description from file
    assert.ok(promptItem.description);

    // Folder should show count
    assert.ok(folderItem.description);
    assert.ok((folderItem.description as string).includes("prompts"));
  });

  test("Empty State Handling", async () => {
    // Create a tree provider with no prompts
    const emptyPromptManager = {
      getPromptStructure: async () => ({
        folders: [],
        rootPrompts: [],
      }),
      onDidChangeTreeData: () => ({ dispose: () => {} }),
    } as any;

    const emptyTreeProvider = new PromptTreeProvider(
      emptyPromptManager,
      mockSearchService
    );
    const rootItems = await emptyTreeProvider.getChildren();

    assert.strictEqual(rootItems.length, 1);
    assert.strictEqual(rootItems[0].label, "No prompts yet");
    assert.ok(rootItems[0].description);
  });

  test("Tree Item Path Finding", async () => {
    const testPath = "/path/test1.md";
    const foundItem = await treeProvider.findTreeItemByPath(testPath);

    assert.ok(foundItem);
    assert.strictEqual(foundItem.promptFile?.path, testPath);
    assert.strictEqual(foundItem.promptFile?.title, "JavaScript Prompt");
  });

  test("Non-existent Path Finding", async () => {
    const nonExistentPath = "/path/nonexistent.md";
    const foundItem = await treeProvider.findTreeItemByPath(nonExistentPath);

    assert.strictEqual(foundItem, undefined);
  });

  test("Search Integration - Event Handling", (done) => {
    let treeRefreshed = false;

    const disposable = treeProvider.onDidChangeTreeData(() => {
      treeRefreshed = true;
      assert.ok(treeRefreshed);
      disposable.dispose();
      done();
    });

    // Setting search criteria should trigger tree refresh
    const searchCriteria: SearchCriteria = {
      query: "test",
      scope: "both",
      caseSensitive: false,
      isActive: true,
    };

    treeProvider.setSearchCriteria(searchCriteria);
  });

  test("Search State Persistence", () => {
    const searchCriteria: SearchCriteria = {
      query: "persistent query",
      scope: "content",
      caseSensitive: true,
      isActive: true,
    };

    treeProvider.setSearchCriteria(searchCriteria);

    // Get criteria again to ensure it's stored
    const retrievedCriteria = treeProvider.getCurrentSearchCriteria();

    assert.ok(retrievedCriteria);
    assert.strictEqual(retrievedCriteria.query, "persistent query");
    assert.strictEqual(retrievedCriteria.scope, "content");
    assert.strictEqual(retrievedCriteria.caseSensitive, true);
    assert.strictEqual(retrievedCriteria.isActive, true);
  });

  test("Multiple Search Criteria Updates", () => {
    const criteria1: SearchCriteria = {
      query: "first",
      scope: "titles",
      caseSensitive: false,
      isActive: true,
    };

    const criteria2: SearchCriteria = {
      query: "second",
      scope: "content",
      caseSensitive: true,
      isActive: true,
    };

    treeProvider.setSearchCriteria(criteria1);
    let current = treeProvider.getCurrentSearchCriteria();
    assert.strictEqual(current?.query, "first");

    treeProvider.setSearchCriteria(criteria2);
    current = treeProvider.getCurrentSearchCriteria();
    assert.strictEqual(current?.query, "second");
    assert.strictEqual(current?.scope, "content");
    assert.strictEqual(current?.caseSensitive, true);
  });
});
