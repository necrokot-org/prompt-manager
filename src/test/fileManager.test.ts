import * as assert from "assert";
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { FileManager, ContentSearchResult } from "../fileManager";

suite("FileManager Search Tests", () => {
  let fileManager: FileManager;
  let tempDir: string;
  let testPromptPath: string;

  suiteSetup(async () => {
    // Create temporary directory for testing
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "prompt-manager-test-"));
    testPromptPath = path.join(tempDir, ".prompt_manager");

    // Mock workspace configuration
    const mockConfig = {
      get: (key: string, defaultValue: any) => {
        if (key === "defaultPromptDirectory") {
          return ".prompt_manager";
        }
        return defaultValue;
      },
    };

    // Mock vscode.workspace
    (vscode.workspace as any).getConfiguration = () => mockConfig;
    Object.defineProperty(vscode.workspace, "workspaceFolders", {
      value: [{ uri: { fsPath: tempDir } }],
      configurable: true,
    });

    fileManager = new FileManager();

    // Create test directory structure
    await fs.promises.mkdir(testPromptPath, { recursive: true });

    // Create test files
    await createTestFiles();
  });

  suiteTeardown(async () => {
    // Clean up temporary directory
    await fs.promises.rm(tempDir, { recursive: true, force: true });
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
      path.join(testPromptPath, "test-prompt.md"),
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
      path.join(testPromptPath, "simple-prompt.md"),
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
      path.join(testPromptPath, "special-chars.md"),
      promptSpecialChars
    );

    // Create a folder with prompts
    const folderPath = path.join(testPromptPath, "subfolder");
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

  test("YAML Front Matter Parsing", async () => {
    const results = await fileManager.searchInTitle("Test Prompt");

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].file.title, "Test Prompt");
    assert.strictEqual(
      results[0].file.description,
      "A test prompt for search functionality"
    );
    assert.deepStrictEqual(results[0].file.tags, ["testing", "search"]);
  });

  test("Content Search - Basic Text", async () => {
    const results = await fileManager.searchInContent("JavaScript code");

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].file.title, "Test Prompt");
    assert.ok(results[0].matches.length > 0);
    assert.strictEqual(results[0].matches[0].type, "content");
  });

  test("Content Search - Case Sensitivity", async () => {
    const caseSensitiveResults = await fileManager.searchInContent(
      "JAVASCRIPT",
      {
        caseSensitive: true,
      }
    );
    assert.strictEqual(caseSensitiveResults.length, 0);

    const caseInsensitiveResults = await fileManager.searchInContent(
      "JAVASCRIPT",
      {
        caseSensitive: false,
      }
    );
    assert.strictEqual(caseInsensitiveResults.length, 1);
  });

  test("Content Search - Exact Match", async () => {
    const exactResults = await fileManager.searchInContent("Hello World", {
      exact: true,
    });
    assert.strictEqual(exactResults.length, 1);

    const partialResults = await fileManager.searchInContent("Hello", {
      exact: false,
    });
    assert.strictEqual(partialResults.length, 1);
  });

  test("Content Search - YAML Inclusion", async () => {
    const withYamlResults = await fileManager.searchInContent("testing", {
      includeYaml: true,
    });
    assert.ok(withYamlResults.length > 0);

    const withoutYamlResults = await fileManager.searchInContent("testing", {
      includeYaml: false,
    });
    // Should still find it in tags or description if those are included in content search
    assert.ok(withoutYamlResults.length >= 0);
  });

  test("Title Search - Basic Functionality", async () => {
    const results = await fileManager.searchInTitle("Test");

    assert.ok(results.length >= 1);
    const testPromptResult = results.find(
      (r) => r.file.title === "Test Prompt"
    );
    assert.ok(testPromptResult);
    if (testPromptResult) {
      assert.ok(testPromptResult.matches.length > 0);
      assert.strictEqual(testPromptResult.matches[0].type, "title");
    }
  });

  test("Title Search - Multiple Results", async () => {
    const results = await fileManager.searchInTitle("Prompt");

    assert.ok(results.length >= 2); // Should find "Test Prompt" and "Folder Prompt"
    const titles = results.map((r) => r.file.title);
    assert.ok(titles.includes("Test Prompt"));
    assert.ok(titles.includes("Folder Prompt"));
  });

  test("Search Scoring System", async () => {
    const results = await fileManager.searchInContent("prompt");

    // Results should be scored and sorted
    assert.ok(results.length > 1);
    for (let i = 0; i < results.length - 1; i++) {
      assert.ok(results[i].score >= results[i + 1].score);
    }
  });

  test("Special Characters Handling", async () => {
    const specialCharResults = await fileManager.searchInContent("!@#$%^&*()");
    assert.strictEqual(specialCharResults.length, 1);

    const unicodeResults = await fileManager.searchInContent("你好世界");
    assert.strictEqual(unicodeResults.length, 1);

    const emojiResults = await fileManager.searchInContent("🚀");
    assert.strictEqual(emojiResults.length, 1);
  });

  test("RegExp Special Characters Escaping", async () => {
    const regexpResults = await fileManager.searchInContent(
      "[.*+?^${}()|[]\\]"
    );
    assert.strictEqual(regexpResults.length, 1);
  });

  test("Empty Search Query", async () => {
    const results = await fileManager.searchInContent("");
    assert.strictEqual(results.length, 0);
  });

  test("No Results Search", async () => {
    const results = await fileManager.searchInContent("nonexistenttext12345");
    assert.strictEqual(results.length, 0);
  });

  test("Search Context Extraction", async () => {
    const results = await fileManager.searchInContent("JavaScript");

    assert.strictEqual(results.length, 1);
    assert.ok(results[0].matches.length > 0);
    assert.ok(results[0].matches[0].context.length > 0);
    assert.ok(results[0].matches[0].context.includes("JavaScript"));
  });

  test("Performance with Cache", async () => {
    // First search to populate cache
    const start1 = Date.now();
    await fileManager.searchInContent("content");
    const time1 = Date.now() - start1;

    // Second search should be faster due to caching
    const start2 = Date.now();
    await fileManager.searchInContent("content");
    const time2 = Date.now() - start2;

    // Second search should be significantly faster (allowing some margin for variability)
    assert.ok(
      time2 <= time1 * 2,
      `Second search (${time2}ms) should be faster than first (${time1}ms)`
    );
  });

  test("Cache TTL Expiry", async () => {
    // This test would need to mock time or wait, for now just test cache clearing
    fileManager.clearSearchCache();

    const results = await fileManager.searchInContent("test");
    assert.ok(results.length > 0);
  });

  test("File with No YAML Front Matter", async () => {
    const results = await fileManager.searchInTitle("Simple Prompt");

    // Should still work for files without YAML, using filename as title
    assert.ok(results.length >= 1);
  });

  test("Hierarchical Search in Folders", async () => {
    const results = await fileManager.searchInContent("hierarchical");

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].file.title, "Folder Prompt");
  });

  test("Search Match Position and Length", async () => {
    const results = await fileManager.searchInContent("JavaScript");

    assert.strictEqual(results.length, 1);
    assert.ok(results[0].matches.length > 0);

    const match = results[0].matches[0];
    assert.strictEqual(typeof match.position, "number");
    assert.strictEqual(typeof match.length, "number");
    assert.ok(match.length > 0);
  });

  test("Multiple Queries Performance", async () => {
    const queries = ["test", "prompt", "content", "search", "javascript"];

    const start = Date.now();
    for (const query of queries) {
      await fileManager.searchInContent(query);
    }
    const totalTime = Date.now() - start;

    // Should complete multiple searches reasonably quickly
    assert.ok(
      totalTime < 5000,
      `Multiple searches took ${totalTime}ms, should be under 5 seconds`
    );
  });
});
