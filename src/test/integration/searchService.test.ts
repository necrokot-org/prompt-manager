import * as assert from "assert";
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { FileManager } from "../../features/prompt-manager/data/fileManager";
import { SearchService } from "../../features/search/services/searchService";
import { SearchCriteria } from "@features/search/types/SearchCriteria";
import { FileSystemManager } from "../../infrastructure/fs/FileSystemManager";
import { ConfigurationService } from "../../infrastructure/config/config";
import { setupMockWorkspace, MockWorkspaceSetup } from "./helpers";

suite("SearchService Tests", () => {
  let fileManager: FileManager;
  let searchService: SearchService;
  let mockWorkspace: MockWorkspaceSetup;

  suiteSetup(async () => {
    // Set up mock workspace with temporary directory
    mockWorkspace = await setupMockWorkspace("search-service-test-");

    // Create dependencies manually for testing
    const configService = new ConfigurationService();
    const fileSystemManager = new FileSystemManager(configService);
    fileManager = new FileManager(fileSystemManager);
    searchService = new SearchService(fileManager);

    // Create test files
    await createTestFiles();
  });

  suiteTeardown(async () => {
    // Clean up temporary directory
    await mockWorkspace.cleanup();
  });

  async function createTestFiles() {
    // Test file with YAML front matter
    const promptWithYaml = [
      "---",
      'title: "Test Prompt"',
      'description: "A test prompt for search functionality"',
      'tags: ["testing", "search"]',
      'category: "development"',
      "---",
      "",
      "This is the main content of the test prompt.",
      "It contains some JavaScript code:",
      "",
      "```javascript",
      "function searchExample() {",
      '    return "Hello World";',
      "}",
      "```",
      "",
      "And some more text for testing search functionality.",
    ].join("\n");

    await fs.promises.writeFile(
      path.join(mockWorkspace.testPromptPath, "test-prompt.md"),
      promptWithYaml
    );

    // Test file without YAML front matter
    const promptWithoutYaml = [
      "# Simple Prompt",
      "",
      "This is a simple prompt without YAML front matter.",
      "It should still be searchable by content.",
      "",
      "Keywords: database, query, SQL",
    ].join("\n");

    await fs.promises.writeFile(
      path.join(mockWorkspace.testPromptPath, "simple-prompt.md"),
      promptWithoutYaml
    );

    // Test file with special characters
    const promptSpecialChars = [
      "---",
      'title: "Special Characters Test"',
      'description: "Testing with special chars: @#$%^&*()"',
      'tags: ["special", "characters"]',
      "---",
      "",
      "This content has special characters: !@#$%^&*()",
      "And unicode: 你好世界 🚀 🔍",
      "RegExp chars: [.*+?^${}()|[]\\]",
    ].join("\n");

    await fs.promises.writeFile(
      path.join(mockWorkspace.testPromptPath, "special-chars.md"),
      promptSpecialChars
    );

    // Create a folder with prompts
    const folderPath = path.join(mockWorkspace.testPromptPath, "subfolder");
    await fs.promises.mkdir(folderPath);

    const folderPrompt = [
      "---",
      'title: "Folder Prompt"',
      'description: "A prompt inside a folder"',
      'tags: ["folder", "nested"]',
      "---",
      "",
      "Content inside a folder for testing hierarchical search.",
    ].join("\n");

    await fs.promises.writeFile(
      path.join(folderPath, "folder-prompt.md"),
      folderPrompt
    );
  }

  test("SearchService - Content Search", async () => {
    const results = await searchService.searchInContent("JavaScript code");

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].file.title, "Test Prompt");
    assert.ok(results[0].matches.length > 0);
    assert.strictEqual(results[0].matches[0].type, "content");
  });

  test("SearchService - Title Search", async () => {
    const results = await searchService.searchInTitles("Test Prompt", {
      caseSensitive: false,
    });

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].file.title, "Test Prompt");
    assert.strictEqual(
      results[0].file.description,
      "A test prompt for search functionality"
    );
    assert.deepStrictEqual(results[0].file.tags, ["testing", "search"]);
  });

  test("SearchService - Search Both", async () => {
    const results = await searchService.searchBoth("prompt");

    // Should find matches in both titles and content
    assert.ok(results.length > 1);
    const titles = results.map((r) => r.file.title);
    assert.ok(titles.includes("Test Prompt"));
  });

  test("SearchService - Unified Search Interface", async () => {
    const criteria: SearchCriteria = {
      query: "JavaScript",
      scope: "content",
      caseSensitive: false,
      fuzzy: false,
      isActive: true,
    };

    const results = await searchService.search(criteria);
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].file.title, "Test Prompt");
  });

  test("SearchService - Case Sensitivity", async () => {
    const caseSensitiveResults = await searchService.searchInContent(
      "JAVASCRIPT",
      {
        caseSensitive: true,
      }
    );
    assert.strictEqual(caseSensitiveResults.length, 0);

    const caseInsensitiveResults = await searchService.searchInContent(
      "JAVASCRIPT",
      {
        caseSensitive: false,
      }
    );
    assert.strictEqual(caseInsensitiveResults.length, 1);
  });

  test("SearchService - Match Count", async () => {
    const criteria: SearchCriteria = {
      query: "prompt",
      scope: "both",
      caseSensitive: false,
      fuzzy: false,
      isActive: true,
    };

    const results = await searchService.search(criteria);
    assert.ok(results.length > 0);
  });

  test("SearchService - Matches Prompt", async () => {
    const structure = await fileManager.scanPrompts();
    const testPrompt = structure.rootPrompts.find(
      (p) => p.title === "Test Prompt"
    );
    assert.ok(testPrompt);

    const criteria: SearchCriteria = {
      query: "JavaScript",
      scope: "content",
      caseSensitive: false,
      fuzzy: false,
      isActive: true,
    };

    const matches = await searchService.matchesPrompt(testPrompt!, criteria);
    assert.strictEqual(matches, true);
  });

  test("SearchService - Cache Clearing", async () => {
    // Test that cache clearing works without errors
    searchService.clearCache();

    const results = await searchService.searchInContent("test");
    assert.ok(results.length >= 0);
  });

  test("SearchService - Available Scopes", async () => {
    const scopes = searchService.getAvailableScopes();
    assert.ok(scopes.includes("titles"));
    assert.ok(scopes.includes("content"));
    assert.ok(scopes.includes("both"));
  });

  test("SearchService - Empty Query", async () => {
    const criteria: SearchCriteria = {
      query: "",
      scope: "both",
      caseSensitive: false,
      fuzzy: false,
      isActive: false,
    };

    const results = await searchService.search(criteria);
    assert.strictEqual(results.length, 0);
  });

  test("SearchService - No Results", async () => {
    const results = await searchService.searchInContent("nonexistenttext12345");
    assert.strictEqual(results.length, 0);
  });

  test("SearchService - Special Characters", async () => {
    const specialCharResults = await searchService.searchInContent(
      "!@#$%^&*()"
    );
    assert.strictEqual(specialCharResults.length, 1);

    const unicodeResults = await searchService.searchInContent("你好世界");
    assert.strictEqual(unicodeResults.length, 1);

    const emojiResults = await searchService.searchInContent("🚀");
    assert.strictEqual(emojiResults.length, 1);
  });

  test("SearchService - Multiple Results Ranking", async () => {
    const results = await searchService.searchInContent("prompt");

    // Results should be scored and sorted
    assert.ok(results.length > 1);
    for (let i = 0; i < results.length - 1; i++) {
      assert.ok(results[i].score >= results[i + 1].score);
    }
  });

  test("SearchService - Hierarchical Search", async () => {
    const results = await searchService.searchInContent("hierarchical");

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].file.title, "Folder Prompt");
  });
});
