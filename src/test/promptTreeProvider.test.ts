import * as assert from "assert";
import * as vscode from "vscode";
import { PromptTreeProvider } from "@features/prompt-manager/ui/tree/PromptTreeProvider";
import { SearchService } from "@features/search/services/searchService";
import { ConfigurationService } from "@infra/config/config";
import {
  FileTreeItem,
  FolderTreeItem,
  EmptyStateTreeItem,
} from "@features/prompt-manager/ui/tree/items";
import { PromptController } from "@features/prompt-manager/domain/promptController";
import {
  PromptFile,
  PromptFolder,
} from "@features/prompt-manager/data/fileManager";
import { SearchCriteria } from "@features/search/ui/SearchPanelProvider";
import { FileSystemManager } from "@infra/fs/FileSystemManager";

describe("PromptTreeProvider", () => {
  let promptTreeProvider: PromptTreeProvider;
  let mockPromptController: any;
  let mockSearchService: any;
  let mockConfigurationService: any;
  let mockFileSystemManager: any;

  beforeEach(() => {
    // Mock PromptController
    mockPromptController = {
      getPromptStructure: () =>
        Promise.resolve({ folders: [], rootPrompts: [] }),
      refresh: () => Promise.resolve(),
    };

    // Mock SearchService
    mockSearchService = {
      search: () => Promise.resolve([]),
    };

    // Mock ConfigurationService
    mockConfigurationService = {
      getDefaultPromptDirectory: () => ".prompt_manager",
      getFileNamingPattern: () => "kebab-case",
      shouldShowDescriptionInTree: () => true,
    };

    // Mock FileSystemManager
    mockFileSystemManager = {
      getPromptManagerPath: () => "/test/path",
      moveFile: () => Promise.resolve(),
      fileExists: () => false,
    };

    promptTreeProvider = new PromptTreeProvider(
      mockPromptController,
      mockSearchService,
      mockConfigurationService,
      mockFileSystemManager
    );
  });

  afterEach(() => {
    promptTreeProvider.dispose();
  });

  describe("getChildren", () => {
    it("should return empty state when no prompts exist", async () => {
      const children = await promptTreeProvider.getChildren();

      assert.strictEqual(children.length, 1);
      assert.ok(children[0] instanceof EmptyStateTreeItem);
      assert.strictEqual(children[0].label, "No prompts yet");
    });

    it("should return folder and file items when prompts exist", async () => {
      const mockStructure = {
        folders: [
          {
            name: "Test Folder",
            path: "/test/folder",
            prompts: [],
          },
        ],
        rootPrompts: [
          {
            name: "test-prompt.md",
            title: "Test Prompt",
            path: "/test/test-prompt.md",
            description: "A test prompt",
            tags: ["test"],
            fileSize: 100,
            isDirectory: false,
          },
        ],
      };

      mockPromptController.getPromptStructure = () =>
        Promise.resolve(mockStructure);

      const children = await promptTreeProvider.getChildren();

      assert.strictEqual(children.length, 2);
      assert.ok(children[0] instanceof FolderTreeItem);
      assert.ok(children[1] instanceof FileTreeItem);
    });
  });

  describe("search functionality", () => {
    it("should filter prompts based on search criteria", async () => {
      const mockStructure = {
        folders: [],
        rootPrompts: [
          {
            name: "matching-prompt.md",
            title: "Matching Prompt",
            path: "/test/matching-prompt.md",
            description: "This matches the search",
            tags: ["match"],
            fileSize: 100,
            isDirectory: false,
          },
          {
            name: "other-prompt.md",
            title: "Other Prompt",
            path: "/test/other-prompt.md",
            description: "This does not match",
            tags: ["other"],
            fileSize: 100,
            isDirectory: false,
          },
        ],
      };

      mockPromptController.getPromptStructure = () =>
        Promise.resolve(mockStructure);

      // Mock search service to return matching results for first prompt only
      mockSearchService.search = (query: string, prompts: PromptFile[]) => {
        return Promise.resolve([
          {
            file: prompts[0], // First prompt matches
            matches: [],
          },
        ]);
      };

      const criteria: SearchCriteria = {
        query: "matching",
        scope: "both",
        caseSensitive: false,
        isActive: true,
      };

      promptTreeProvider.setSearchCriteria(criteria);
      const children = await promptTreeProvider.getChildren();

      // Should only return the matching prompt
      assert.strictEqual(children.length, 1);
      assert.ok(children[0] instanceof FileTreeItem);
      assert.strictEqual(
        (children[0] as FileTreeItem).label,
        "Matching Prompt"
      );
    });

    it("should show no results message when no prompts match", async () => {
      const mockStructure = {
        folders: [],
        rootPrompts: [
          {
            name: "test-prompt.md",
            title: "Test Prompt",
            path: "/test/test-prompt.md",
            description: "A test prompt",
            tags: ["test"],
            fileSize: 100,
            isDirectory: false,
          },
        ],
      };

      mockPromptController.getPromptStructure = () =>
        Promise.resolve(mockStructure);
      mockSearchService.search = () => Promise.resolve([]); // No matches

      const criteria: SearchCriteria = {
        query: "nonexistent",
        scope: "both",
        caseSensitive: false,
        isActive: true,
      };

      promptTreeProvider.setSearchCriteria(criteria);
      const children = await promptTreeProvider.getChildren();

      assert.strictEqual(children.length, 1);
      assert.ok(children[0] instanceof EmptyStateTreeItem);
      assert.strictEqual(children[0].label, "No matching prompts");
    });
  });

  describe("drag and drop", () => {
    it("should handle drag operation for file items", async () => {
      const mockPromptFile: PromptFile = {
        name: "test-prompt.md",
        title: "Test Prompt",
        path: "/test/test-prompt.md",
        description: "A test prompt",
        tags: ["test"],
        fileSize: 100,
        isDirectory: false,
      };

      const fileItem = new FileTreeItem(mockPromptFile);
      const dataTransfer = new vscode.DataTransfer();

      await promptTreeProvider.handleDrag(
        [fileItem],
        dataTransfer,
        new vscode.CancellationTokenSource().token
      );

      const dragData = dataTransfer.get(
        "application/vnd.code.tree.promptmanager"
      );
      assert.ok(dragData);
      assert.strictEqual(dragData.value, "/test/test-prompt.md");
    });

    it("should not handle drag for non-file items", async () => {
      const folderItem = new FolderTreeItem({
        name: "Test Folder",
        path: "/test/folder",
        prompts: [],
      });
      const dataTransfer = new vscode.DataTransfer();

      await promptTreeProvider.handleDrag(
        [folderItem],
        dataTransfer,
        new vscode.CancellationTokenSource().token
      );

      const dragData = dataTransfer.get(
        "application/vnd.code.tree.promptmanager"
      );
      assert.strictEqual(dragData, undefined);
    });
  });
});
