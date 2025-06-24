import * as assert from "assert";
import { searchResultToPromptFile } from "@features/search/utils/promptFile";
import { PromptFile } from "@root/scanner/types";
import { SearchResult } from "@features/search/core/SearchEngine";
import { FileSystemManager } from "@infra/fs/FileSystemManager";

suite("PromptFile Utils Tests", () => {
  test("should return existing file when found in allFiles", async () => {
    // Arrange
    const existingFile: PromptFile = {
      name: "existing-prompt.md",
      title: "Existing Prompt",
      path: "/path/to/existing-prompt.md",
      description: "An existing prompt",
      tags: ["test", "existing"],
      fileSize: 1024,
      isDirectory: false,
    };

    const allFiles = [existingFile];

    const searchResult: SearchResult = {
      filePath: "/path/to/existing-prompt.md",
      fileName: "existing-prompt.md",
      title: "Search Title", // Different title to verify we get the existing file
      score: 0.8,
      matches: [],
      snippet: "test snippet",
    };

    // Mock FileSystemManager (won't be called in this case)
    const mockFileSystemManager = {} as FileSystemManager;

    // Act
    const result = await searchResultToPromptFile(
      searchResult,
      allFiles,
      mockFileSystemManager
    );

    // Assert
    assert.strictEqual(result, existingFile); // Should return the exact existing file
    assert.strictEqual(result.title, "Existing Prompt"); // Should use existing file's title
    assert.strictEqual(result.description, "An existing prompt");
    assert.deepStrictEqual(result.tags, ["test", "existing"]);
    assert.strictEqual(result.fileSize, 1024);
  });

  test("should handle file not found in allFiles", async () => {
    // Arrange
    const allFiles: PromptFile[] = []; // Empty array

    const searchResult: SearchResult = {
      filePath: "/path/to/new-prompt.md",
      fileName: "new-prompt.md",
      title: "New Prompt",
      score: 0.8,
      matches: [],
      snippet: "test snippet",
    };

    // Mock FileSystemManager that will throw (simulating file not found)
    const mockFileSystemManager = {
      async getFileStats(filePath: string) {
        throw new Error(`File not found: ${filePath}`);
      },
    } as unknown as FileSystemManager;

    // Act
    const result = await searchResultToPromptFile(
      searchResult,
      allFiles,
      mockFileSystemManager
    );

    // Assert - Should return minimal file info when stats fail
    assert.strictEqual(result.path, "/path/to/new-prompt.md");
    assert.strictEqual(result.name, "new-prompt.md");
    assert.strictEqual(result.title, "New Prompt");
    assert.strictEqual(result.description, undefined);
    assert.deepStrictEqual(result.tags, []);
    assert.strictEqual(result.fileSize, 0); // Default when stats fail
    assert.strictEqual(result.isDirectory, false);
  });
});
