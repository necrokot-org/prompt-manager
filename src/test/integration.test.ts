import * as assert from "assert";
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { SearchPanelProvider, SearchCriteria } from "../searchPanelProvider";
import { PromptTreeProvider } from "../promptTreeProvider";
import { FileManager } from "../fileManager";
import { PromptController } from "../promptController";
import {
  setupMockWorkspace,
  createMockExtensionUri,
  MockWorkspaceSetup,
} from "./helpers";

suite("Search Integration Tests", () => {
  let searchProvider: SearchPanelProvider;
  let treeProvider: PromptTreeProvider;
  let fileManager: FileManager;
  let promptController: PromptController;
  let mockWorkspace: MockWorkspaceSetup;
  let mockExtensionUri: vscode.Uri;

  suiteSetup(async () => {
    // Set up mock workspace with temporary directory
    mockWorkspace = await setupMockWorkspace("search-integration-test-");
    await createIntegrationTestFiles(mockWorkspace.testPromptPath);

    // Initialize components
    mockExtensionUri = createMockExtensionUri();
    searchProvider = new SearchPanelProvider(mockExtensionUri);

    // Mock PromptController for tree provider
    const mockPromptController = {
      getPromptStructure: async () => ({
        folders: [],
        rootPrompts: [],
      }),
      onDidChangeTreeData: () => ({ dispose: () => {} }),
    } as any;

    treeProvider = new PromptTreeProvider(mockPromptController);
  });

  suiteTeardown(async () => {
    // Clean up temporary directory
    await mockWorkspace.cleanup();
  });

  async function createIntegrationTestFiles(promptPath: string) {
    // Create multiple test files for comprehensive integration testing
    const files = [
      {
        name: "javascript-helper.md",
        content: [
          "---",
          'title: "JavaScript Helper"',
          'description: "Helpful JavaScript utilities and functions"',
          'tags: ["javascript", "utilities", "helper"]',
          "---",
          "",
          "This prompt contains JavaScript utility functions.",
          "",
          "```javascript",
          "function debounce(func, wait) {",
          "    let timeout;",
          "    return function executedFunction(...args) {",
          "        const later = () => {",
          "            clearTimeout(timeout);",
          "            func(...args);",
          "        };",
          "        clearTimeout(timeout);",
          "        timeout = setTimeout(later, wait);",
          "    };",
          "}",
          "```",
        ].join("\n"),
      },
      {
        name: "python-automation.md",
        content: [
          "---",
          'title: "Python Automation Scripts"',
          'description: "Collection of Python automation scripts"',
          'tags: ["python", "automation", "scripts"]',
          "---",
          "",
          "This prompt contains Python automation scripts for various tasks.",
          "",
          "File processing, data manipulation, and system automation.",
          "Perfect for DevOps and data processing workflows.",
        ].join("\n"),
      },
      {
        name: "database-queries.md",
        content: [
          "---",
          'title: "SQL Database Queries"',
          'description: "Common SQL queries and database operations"',
          'tags: ["sql", "database", "queries"]',
          "---",
          "",
          "Collection of useful SQL queries:",
          "",
          "- SELECT statements with JOIN operations",
          "- UPDATE and DELETE queries",
          "- Performance optimization tips",
          "- Index creation strategies",
        ].join("\n"),
      },
      {
        name: "react-components.md",
        content: [
          "---",
          'title: "React Component Templates"',
          'description: "Reusable React component patterns"',
          'tags: ["react", "components", "javascript", "frontend"]',
          "---",
          "",
          "React component patterns and templates:",
          "",
          "- Functional components with hooks",
          "- State management patterns",
          "- Performance optimization techniques",
          "- Testing strategies for React components",
        ].join("\n"),
      },
    ];

    // Create root files
    for (const file of files) {
      await fs.promises.writeFile(
        path.join(promptPath, file.name),
        file.content
      );
    }

    // Create a subfolder with additional files
    const subfolderPath = path.join(promptPath, "advanced");
    await fs.promises.mkdir(subfolderPath);

    const advancedFiles = [
      {
        name: "machine-learning.md",
        content: [
          "---",
          'title: "Machine Learning Algorithms"',
          'description: "Advanced ML algorithms and implementations"',
          'tags: ["ml", "algorithms", "python", "advanced"]',
          "---",
          "",
          "Advanced machine learning concepts:",
          "",
          "- Neural network architectures",
          "- Deep learning frameworks",
          "- Model optimization techniques",
          "- Performance evaluation metrics",
        ].join("\n"),
      },
      {
        name: "system-design.md",
        content: [
          "---",
          'title: "System Design Patterns"',
          'description: "Scalable system design patterns and architectures"',
          'tags: ["architecture", "design", "systems", "scalability"]',
          "---",
          "",
          "System design patterns for scalable applications:",
          "",
          "- Microservices architecture",
          "- Load balancing strategies",
          "- Database sharding techniques",
          "- Caching mechanisms and patterns",
        ].join("\n"),
      },
    ];

    for (const file of advancedFiles) {
      await fs.promises.writeFile(
        path.join(subfolderPath, file.name),
        file.content
      );
    }
  }

  test("Search and Tree Provider Integration", (done) => {
    let searchEventReceived = false;
    let treeRefreshed = false;

    // Listen for search events
    const searchDisposable = searchProvider.onDidChangeSearch((criteria) => {
      searchEventReceived = true;
      assert.strictEqual(criteria.query, "test");
      assert.strictEqual(criteria.scope, "both");
      assert.strictEqual(criteria.isActive, true);

      // Apply search criteria to tree provider
      treeProvider.setSearchCriteria(criteria);
    });

    // Listen for tree refresh events
    const treeDisposable = treeProvider.onDidChangeTreeData(() => {
      treeRefreshed = true;

      if (searchEventReceived && treeRefreshed) {
        // Verify search state in tree provider
        const currentCriteria = treeProvider.getCurrentSearchCriteria();
        assert.ok(currentCriteria);
        assert.strictEqual(currentCriteria.query, "test");

        searchDisposable.dispose();
        treeDisposable.dispose();
        done();
      }
    });

    // Mock webview to simulate user interaction
    const mockWebview = {
      options: {},
      html: "",
      onDidReceiveMessage: (handler: (message: any) => void) => {
        setTimeout(() => {
          handler({
            type: "searchChanged",
            query: "test",
            scope: "both",
            caseSensitive: false,
          });
        }, 10);
        return { dispose: () => {} };
      },
      postMessage: () => Promise.resolve(true),
    };

    const mockWebviewView = {
      webview: mockWebview,
      visible: true,
      onDidDispose: () => ({ dispose: () => {} }),
      onDidChangeVisibility: () => ({ dispose: () => {} }),
      show: () => {},
      title: "Search",
      description: "",
    };

    // Initialize the search provider
    searchProvider.resolveWebviewView(
      mockWebviewView as any,
      {} as any,
      {} as any
    );
  });

  test("Search State Persistence", () => {
    const persistentCriteria: SearchCriteria = {
      query: "persistent test",
      scope: "content",
      caseSensitive: true,
      isActive: true,
    };

    // Set search criteria
    treeProvider.setSearchCriteria(persistentCriteria);

    // Verify persistence
    const retrievedCriteria = treeProvider.getCurrentSearchCriteria();
    assert.ok(retrievedCriteria);
    assert.strictEqual(retrievedCriteria.query, "persistent test");
    assert.strictEqual(retrievedCriteria.scope, "content");
    assert.strictEqual(retrievedCriteria.caseSensitive, true);
    assert.strictEqual(retrievedCriteria.isActive, true);
  });

  test("Clear Search Integration", (done) => {
    // First set some search criteria
    const initialCriteria: SearchCriteria = {
      query: "test search",
      scope: "both",
      caseSensitive: false,
      isActive: true,
    };

    treeProvider.setSearchCriteria(initialCriteria);

    // Listen for clear events
    const searchDisposable = searchProvider.onDidChangeSearch((criteria) => {
      if (criteria.query === "" && !criteria.isActive) {
        treeProvider.setSearchCriteria(null);

        // Verify search was cleared
        const currentCriteria = treeProvider.getCurrentSearchCriteria();
        assert.strictEqual(currentCriteria, null);

        searchDisposable.dispose();
        done();
      }
    });

    // Mock clear search message
    const mockWebview = {
      options: {},
      html: "",
      onDidReceiveMessage: (handler: (message: any) => void) => {
        setTimeout(() => {
          handler({ type: "clearSearch" });
        }, 10);
        return { dispose: () => {} };
      },
      postMessage: () => Promise.resolve(true),
    };

    const mockWebviewView = {
      webview: mockWebview,
      visible: true,
      onDidDispose: () => ({ dispose: () => {} }),
      onDidChangeVisibility: () => ({ dispose: () => {} }),
      show: () => {},
      title: "Search",
      description: "",
    };

    searchProvider.resolveWebviewView(
      mockWebviewView as any,
      {} as any,
      {} as any
    );
  });

  test("Result Count Update Integration", () => {
    let resultCount = -1;

    // Mock result count update
    const originalUpdateResultCount = searchProvider.updateResultCount;
    searchProvider.updateResultCount = (count: number) => {
      resultCount = count;
      return originalUpdateResultCount.call(searchProvider, count);
    };

    // Test updating result count
    searchProvider.updateResultCount(5);
    assert.strictEqual(resultCount, 5);

    // Restore original method
    searchProvider.updateResultCount = originalUpdateResultCount;
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

  test("Search Event Handling Chain", (done) => {
    let step = 0;

    const disposable = searchProvider.onDidChangeSearch((criteria) => {
      step++;

      if (step === 1) {
        // First search
        assert.strictEqual(criteria.query, "step1");
        assert.strictEqual(criteria.isActive, true);
      } else if (step === 2) {
        // Second search
        assert.strictEqual(criteria.query, "step2");
        assert.strictEqual(criteria.scope, "titles");
      } else if (step === 3) {
        // Clear search
        assert.strictEqual(criteria.query, "");
        assert.strictEqual(criteria.isActive, false);

        disposable.dispose();
        done();
      }
    });

    // Mock sequential webview messages
    const mockWebview = {
      options: {},
      html: "",
      onDidReceiveMessage: (handler: (message: any) => void) => {
        setTimeout(() => {
          handler({
            type: "searchChanged",
            query: "step1",
            scope: "both",
            caseSensitive: false,
          });

          setTimeout(() => {
            handler({
              type: "searchChanged",
              query: "step2",
              scope: "titles",
              caseSensitive: true,
            });

            setTimeout(() => {
              handler({ type: "clearSearch" });
            }, 5);
          }, 5);
        }, 10);
        return { dispose: () => {} };
      },
      postMessage: () => Promise.resolve(true),
    };

    const mockWebviewView = {
      webview: mockWebview,
      visible: true,
      onDidDispose: () => ({ dispose: () => {} }),
      onDidChangeVisibility: () => ({ dispose: () => {} }),
      show: () => {},
      title: "Search",
      description: "",
    };

    searchProvider.resolveWebviewView(
      mockWebviewView as any,
      {} as any,
      {} as any
    );
  });
});
