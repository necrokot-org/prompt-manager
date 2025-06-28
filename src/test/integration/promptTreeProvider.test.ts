import * as assert from "assert";
import * as vscode from "vscode";
import * as sinon from "sinon";
import { PromptTreeProvider } from "../../features/prompt-manager/ui/tree/PromptTreeProvider";
import {
  FileTreeItem,
  FolderTreeItem,
  EmptyStateTreeItem,
} from "../../features/prompt-manager/ui/tree/items";
import { PromptFile } from "../../features/prompt-manager/data/fileManager";
import { SearchCriteria } from "../../features/search/ui/SearchPanelProvider";

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
      moveFolder: () => Promise.resolve(),
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
      // Updated to expect JSON format with path and type
      assert.strictEqual(
        dragData.value,
        '{"path":"/test/test-prompt.md","type":"file"}'
      );
    });

    test("should handle drag operation for folder items", async () => {
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
      // Updated to expect drag data for folders (now supported)
      assert.ok(dragData);
      assert.strictEqual(
        dragData.value,
        '{"path":"/test/folder","type":"folder"}'
      );
    });
  });

  suite("drag and drop edge cases", () => {
    let showErrorMessageStub: sinon.SinonStub;
    let showInformationMessageStub: sinon.SinonStub;
    let pathExistsStub: sinon.SinonStub;
    let fsExtraStub: sinon.SinonStub;

    setup(() => {
      // Clean up any existing stubs
      sinon.restore();

      showErrorMessageStub = sinon
        .stub(vscode.window, "showErrorMessage")
        .resolves();
      showInformationMessageStub = sinon
        .stub(vscode.window, "showInformationMessage")
        .resolves();

      // Mock fs-extra pathExists
      const fsExtra = require("fs-extra");
      fsExtraStub = sinon.stub(fsExtra, "pathExists").resolves(false); // Default: no conflicts

      // Reset file system manager mocks
      mockFileSystemManager.moveFile = sinon.stub().returns("not called");
      mockFileSystemManager.moveFolder = sinon.stub().returns("not called");
    });

    teardown(() => {
      sinon.restore();
    });

    test("should show error when dropping folder into its subdirectory", async () => {
      const folderItem = new FolderTreeItem({
        name: "Parent Folder",
        path: "/test/parent-folder",
        prompts: [],
      });

      const subfolderItem = new FolderTreeItem({
        name: "Sub Folder",
        path: "/test/parent-folder/sub-folder",
        prompts: [],
      });

      // Simulate dragging parent folder onto its subfolder
      const dataTransfer = new vscode.DataTransfer();
      dataTransfer.set(
        "application/vnd.code.tree.promptmanager",
        new vscode.DataTransferItem(
          '{"path":"/test/parent-folder","type":"folder"}'
        )
      );

      // Set current drag state (simulating drag start)
      await promptTreeProvider.handleDrag([folderItem], dataTransfer);

      // Try to drop parent folder onto its subfolder
      await promptTreeProvider.handleDrop(subfolderItem, dataTransfer);

      // Verify error message was shown
      assert.ok(showErrorMessageStub.calledOnce, "Should show error message");
      assert.ok(
        showErrorMessageStub.firstCall.args[0].includes(
          "Cannot move folder into itself"
        ),
        "Error message should mention folder self-containment"
      );
    });

    test("should show error when dropping file into folder with conflicting name", async () => {
      const targetFolderItem = new FolderTreeItem({
        name: "Target Folder",
        path: "/test/target-folder",
        prompts: [],
      });

      const sourceFileItem = new FileTreeItem({
        name: "existing-prompt.md",
        title: "Existing Prompt",
        path: "/test/existing-prompt.md",
        description: "Source file",
        tags: [],
        fileSize: 100,
        isDirectory: false,
      });

      // Mock pathExists to return true for the conflicting target path
      fsExtraStub
        .withArgs("/test/target-folder/existing-prompt.md")
        .resolves(true);

      const dataTransfer = new vscode.DataTransfer();
      dataTransfer.set(
        "application/vnd.code.tree.promptmanager",
        new vscode.DataTransferItem(
          '{"path":"/test/existing-prompt.md","type":"file"}'
        )
      );

      // Set current drag state
      await promptTreeProvider.handleDrag([sourceFileItem], dataTransfer);

      // Try to drop file where target already exists
      await promptTreeProvider.handleDrop(targetFolderItem, dataTransfer);

      // Verify error message was shown for conflicting name
      assert.ok(showErrorMessageStub.calledOnce, "Should show error message");
      assert.ok(
        showErrorMessageStub.firstCall.args[0].includes(
          "target already exists"
        ),
        "Error message should mention target conflict"
      );
    });

    test("should return early when dropping item on itself", async () => {
      const fileItem = new FileTreeItem({
        name: "test-prompt.md",
        title: "Test Prompt",
        path: "/test/test-prompt.md",
        description: "Test file",
        tags: [],
        fileSize: 100,
        isDirectory: false,
      });

      const dataTransfer = new vscode.DataTransfer();
      dataTransfer.set(
        "application/vnd.code.tree.promptmanager",
        new vscode.DataTransferItem(
          '{"path":"/test/test-prompt.md","type":"file"}'
        )
      );

      // Set current drag state
      await promptTreeProvider.handleDrag([fileItem], dataTransfer);

      // Try to drop file on itself (same path)
      await promptTreeProvider.handleDrop(fileItem, dataTransfer);

      // Should return early without any messages or operations
      assert.ok(
        showErrorMessageStub.notCalled,
        "Should not show error message"
      );
      assert.ok(
        showInformationMessageStub.notCalled,
        "Should not show success message"
      );
      assert.strictEqual(
        mockFileSystemManager.moveFile.callCount,
        0,
        "Should not attempt file move"
      );
    });

    test("should handle successful file move with immediate refresh", async () => {
      const sourceFileItem = new FileTreeItem({
        name: "source-prompt.md",
        title: "Source Prompt",
        path: "/test/source-prompt.md",
        description: "Source file",
        tags: [],
        fileSize: 100,
        isDirectory: false,
      });

      const targetFolderItem = new FolderTreeItem({
        name: "Target Folder",
        path: "/test/target-folder",
        prompts: [],
      });

      // Mock successful move operation and refresh
      mockFileSystemManager.moveFile = sinon.stub().resolves();
      mockPromptController.refresh = sinon.stub().resolves();

      const dataTransfer = new vscode.DataTransfer();
      dataTransfer.set(
        "application/vnd.code.tree.promptmanager",
        new vscode.DataTransferItem(
          '{"path":"/test/source-prompt.md","type":"file"}'
        )
      );

      // Set current drag state
      await promptTreeProvider.handleDrag([sourceFileItem], dataTransfer);

      // Drop file into folder
      await promptTreeProvider.handleDrop(targetFolderItem, dataTransfer);

      // Verify move operation was called
      assert.ok(
        mockFileSystemManager.moveFile.calledOnce,
        "Should call moveFile"
      );

      // Use path.normalize for cross-platform compatibility
      const actualSourcePath = mockFileSystemManager.moveFile.firstCall.args[0];
      const actualTargetPath = mockFileSystemManager.moveFile.firstCall.args[1];

      assert.ok(
        actualSourcePath.includes("source-prompt.md"),
        "Should move from source file"
      );
      assert.ok(
        actualTargetPath.includes("target-folder"),
        "Should move to target folder"
      );
      assert.ok(
        actualTargetPath.includes("source-prompt.md"),
        "Should preserve filename"
      );

      // Verify success message and refresh
      assert.ok(
        showInformationMessageStub.calledOnce,
        "Should show success message"
      );
      assert.ok(mockPromptController.refresh.calledOnce, "Should refresh tree");
    });
  });

  suite("folder move operations", () => {
    let showInformationMessageStub: sinon.SinonStub;

    setup(() => {
      sinon.restore();
      showInformationMessageStub = sinon
        .stub(vscode.window, "showInformationMessage")
        .resolves();

      // Mock fs-extra pathExists to return false (no conflicts)
      const fsExtra = require("fs-extra");
      sinon.stub(fsExtra, "pathExists").resolves(false);
    });

    teardown(() => {
      sinon.restore();
    });

    test("should handle folder move with cache clearing", async () => {
      const sourceFolderItem = new FolderTreeItem({
        name: "Source Folder",
        path: "/test/source-folder",
        prompts: [],
      });

      const targetFolderItem = new FolderTreeItem({
        name: "Target Folder",
        path: "/test/target-folder",
        prompts: [],
      });

      // Mock the fileManager methods
      const mockFileManager = {
        clearContentCache: sinon.stub(),
        rebuildIndexForce: sinon.stub().resolves(),
      };

      mockPromptController.getRepository = sinon.stub().returns({
        getFileManager: () => mockFileManager,
      });

      // Mock successful folder move
      mockFileSystemManager.moveFolder = sinon.stub().resolves();

      const dataTransfer = new vscode.DataTransfer();
      dataTransfer.set(
        "application/vnd.code.tree.promptmanager",
        new vscode.DataTransferItem(
          '{"path":"/test/source-folder","type":"folder"}'
        )
      );

      // Set current drag state and drop
      await promptTreeProvider.handleDrag([sourceFolderItem], dataTransfer);
      await promptTreeProvider.handleDrop(targetFolderItem, dataTransfer);

      // Verify immediate operations
      assert.ok(
        mockFileSystemManager.moveFolder.calledOnce,
        "Should call moveFolder"
      );
      assert.ok(
        mockFileManager.clearContentCache.calledOnce,
        "Should clear content cache"
      );
      assert.ok(
        showInformationMessageStub.calledOnce,
        "Should show success message"
      );

      // Note: The setTimeout-based rebuildIndexForce is tested at integration level
      // as it requires complex timing control that's difficult to test in unit tests
    });

    test("should handle folder move failure gracefully", async () => {
      const sourceFolderItem = new FolderTreeItem({
        name: "Source Folder",
        path: "/test/source-folder",
        prompts: [],
      });

      // Mock failed folder move
      mockFileSystemManager.moveFolder = sinon
        .stub()
        .rejects(new Error("Move failed"));

      const showErrorStub = sinon
        .stub(vscode.window, "showErrorMessage")
        .resolves();

      const dataTransfer = new vscode.DataTransfer();
      dataTransfer.set(
        "application/vnd.code.tree.promptmanager",
        new vscode.DataTransferItem(
          '{"path":"/test/source-folder","type":"folder"}'
        )
      );

      // Set current drag state and drop on root
      await promptTreeProvider.handleDrag([sourceFolderItem], dataTransfer);
      await promptTreeProvider.handleDrop(undefined, dataTransfer);

      // Verify error handling
      assert.ok(
        mockFileSystemManager.moveFolder.calledOnce,
        "Should attempt folder move"
      );
      assert.ok(showErrorStub.calledOnce, "Should show error message");
      assert.ok(
        showInformationMessageStub.notCalled,
        "Should not show success message"
      );
    });
  });
});
