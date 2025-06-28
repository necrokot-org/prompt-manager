import * as assert from "assert";
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  FileManager,
  ContentSearchResult,
} from "@features/prompt-manager/data/fileManager";
import { FileSystemManager } from "@infra/fs/FileSystemManager";
import { ConfigurationService } from "@infra/config/config";
import { setupMockWorkspace, MockWorkspaceSetup } from "./helpers";

suite("FileManager Core Tests", () => {
  let fileManager: FileManager;
  let mockWorkspace: MockWorkspaceSetup;

  suiteSetup(async () => {
    // Set up mock workspace with temporary directory
    mockWorkspace = await setupMockWorkspace("prompt-manager-test-");

    // Create dependencies manually for testing
    const configService = new ConfigurationService();
    const fileSystemManager = new FileSystemManager(configService);
    fileManager = new FileManager(fileSystemManager);

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

  test("File System Operations - Directory Scanning", async () => {
    const structure = await fileManager.scanPrompts();

    assert.ok(structure.rootPrompts.length > 0);
    assert.ok(structure.folders.length > 0);

    // Verify we have the expected test files
    const promptTitles = structure.rootPrompts.map((p) => p.title);
    assert.ok(
      promptTitles.some(
        (title) =>
          title.includes("Test Prompt") || title.includes("test-prompt")
      )
    );
  });

  test("File System Operations - Create Prompt File", async () => {
    const fileName = "new-test-prompt";
    const filePath = await fileManager.createPromptFile(fileName);

    assert.ok(filePath !== null);
    assert.ok(filePath!.endsWith(`${fileName}.md`));

    // Verify file exists
    assert.ok(fs.existsSync(filePath!));
  });

  test("File System Operations - Create Folder", async () => {
    const folderName = "new-test-folder";
    const folderPath = await fileManager.createFolder(folderName);

    assert.ok(folderPath !== null);
    assert.ok(folderPath!.endsWith(folderName));

    // Verify folder exists
    assert.ok(fs.existsSync(folderPath!));
  });

  test("File System Operations - Delete File", async () => {
    // First create a file to delete
    const fileName = "temp-delete-test";
    const filePath = await fileManager.createPromptFile(fileName);
    assert.ok(filePath !== null);
    assert.ok(fs.existsSync(filePath!));

    // Now delete it
    const success = await fileManager.deletePromptFile(filePath!);
    assert.strictEqual(success, true);
    assert.ok(!fs.existsSync(filePath!));
  });

  test("File System Operations - Index Management", async () => {
    // Test index invalidation and rebuilding
    await fileManager.rebuildIndex();

    // Build index should work without errors
    await fileManager.buildIndex();

    // Should still be able to scan after rebuild
    const structure = await fileManager.scanPrompts();
    assert.ok(structure.rootPrompts.length >= 0);
  });

  test("File System Operations - Content Cache", async () => {
    // Test content cache clearing
    fileManager.clearContentCache();

    // Should still work after cache clearing
    const structure = await fileManager.scanPrompts();
    assert.ok(structure.rootPrompts.length >= 0);
  });

  test("Component Access - FileSystemManager", async () => {
    const fsManager = fileManager.getFileSystemManager();
    assert.ok(fsManager !== null);
    assert.ok(typeof fsManager.getPromptManagerPath === "function");
  });

  test("Component Access - DirectoryScanner", async () => {
    const scanner = fileManager.getDirectoryScanner();
    assert.ok(scanner !== null);
    assert.ok(typeof scanner.scanPrompts === "function");
  });
});
