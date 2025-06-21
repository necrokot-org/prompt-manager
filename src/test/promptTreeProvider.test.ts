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

suite("PromptTreeProvider", () => {
  let promptTreeProvider: PromptTreeProvider;
  let mockPromptController: any;
  let mockSearchService: any;
  let mockConfigurationService: any;
  let mockFileSystemManager: any;

  setup(() => {
    // Mock PromptController
    mockPromptController = {
      getPromptStructure: () =>
        Promise.resolve({ folders: [], rootPrompts: [] }),
      refresh: () => Promise.resolve(),
      getRepository: () => ({
        getFileManager: () => ({
          getPromptManagerPath: () => "/test/path",
        }),
      }),
    };

    // Mock SearchService
    mockSearchService = {
      search: () => Promise.resolve([]),
      matchesPrompt: () => Promise.resolve(false), // Add missing method
    };

    // Mock ConfigurationService
    mockConfigurationService = {
      getDefaultPromptDirectory: () => ".prompt_manager",
      getFileNamingPattern: () => "kebab-case",
      shouldShowDescriptionInTree: () => true,
      getShowDescriptionInTree: () => true, // Add missing method
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

  teardown(() => {
    promptTreeProvider.dispose();
  });

  suite("getChildren", () => {
    test("should return empty state when no prompts exist", async () => {
      const children = await promptTreeProvider.getChildren();

      assert.strictEqual(children.length, 1);
      assert.ok(children[0] instanceof EmptyStateTreeItem);
      assert.strictEqual(children[0].label, "No prompts yet");
    });

    test("should return folder and file items when prompts exist", async () => {
      const mockStructure = {
        folders: [
          {
            name: "Test Folder",
            path: "/test/path/Test Folder", // Path should be under the base path
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

  suite("search functionality", () => {
    test("should filter prompts based on search criteria", async () => {
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

      // Mock matchesPrompt to return true only for the first prompt
      mockSearchService.matchesPrompt = (prompt: any, criteria: any) => {
        return Promise.resolve(prompt.path === "/test/matching-prompt.md");
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

    test("should show no results message when no prompts match", async () => {
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
      
      // Mock matchesPrompt to return false for all prompts
      mockSearchService.matchesPrompt = () => Promise.resolve(false);

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

  suite("drag and drop", () => {
    test("should handle drag operation for file items", async () => {
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

      await promptTreeProvider.handleDrag([fileItem], dataTransfer);

      const dragData = dataTransfer.get(
        "application/vnd.code.tree.promptmanager"
      );
      assert.ok(dragData);
      assert.strictEqual(dragData.value, "/test/test-prompt.md");
    });

    test("should not handle drag for non-file items", async () => {
      const folderItem = new FolderTreeItem({
        name: "Test Folder",
        path: "/test/folder",
        prompts: [],
      });
      const dataTransfer = new vscode.DataTransfer();

      await promptTreeProvider.handleDrag([folderItem], dataTransfer);

      const dragData = dataTransfer.get(
        "application/vnd.code.tree.promptmanager"
      );
      assert.strictEqual(dragData, undefined);
    });
  });
});
