import { expect } from "chai";
import { searchResultToPromptFile } from "@features/search/utils/promptFile";
import { PromptFile } from "@root/scanner/types";
import { SearchResult } from "@features/search/core/FlexSearchService";
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
      id: "/path/to/existing-prompt.md",
      filePath: "/path/to/existing-prompt.md",
      fileName: "existing-prompt.md",
      title: "Search Title", // Different title to verify we get the existing file
      score: 0.8,
      matches: {},
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
    expect(result).to.equal(existingFile); // Should return the exact existing file
    expect(result.title).to.equal("Existing Prompt"); // Should use existing file's title
    expect(result.description).to.equal("An existing prompt");
    expect(result.tags).to.deep.equal(["test", "existing"]);
    expect(result.fileSize).to.equal(1024);
  });

  test("should handle file not found in allFiles", async () => {
    // Arrange
    const allFiles: PromptFile[] = []; // Empty array

    const searchResult: SearchResult = {
      id: "/path/to/new-prompt.md",
      filePath: "/path/to/new-prompt.md",
      fileName: "new-prompt.md",
      title: "New Prompt",
      score: 0.8,
      matches: {},
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
    expect(result.path).to.equal("/path/to/new-prompt.md");
    expect(result.name).to.equal("new-prompt.md");
    expect(result.title).to.equal("New Prompt");
    expect(result.description).to.equal(undefined);
    expect(result.tags).to.deep.equal([]);
    expect(result.fileSize).to.equal(0); // Default when stats fail
    expect(result.isDirectory).to.equal(false);
  });
});
