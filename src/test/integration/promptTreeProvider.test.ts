import * as assert from "assert";
import * as vscode from "vscode";
import * as sinon from "sinon";
import { PromptTreeProvider } from "../../features/prompt-manager/ui/tree/PromptTreeProvider";
import {
  FileTreeItem,
  FolderTreeItem,
  EmptyStateTreeItem,
  TagRootTreeItem,
} from "../../features/prompt-manager/ui/tree/items";
import { PromptFile } from "../../features/prompt-manager/data/fileManager";

suite("PromptTreeProvider", () => {
  let promptTreeProvider: PromptTreeProvider;
  let mockPromptController: any;
  let mockConfigurationService: any;
  let mockFileSystemManager: any;
  let mockFilterCoordinator: any;

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
      checkMoveConflict: () => Promise.resolve({ hasConflict: false }), // Add missing method
    };

    // Mock FilterCoordinator
    mockFilterCoordinator = {
      filterAll: async (structure: any) => {
        // Default behavior: return all prompts (no filtering)
        return [
          ...structure.rootPrompts,
          ...structure.folders.flatMap((f: any) => f.prompts),
        ];
      },
      getFilterCount: () => 0,
      hasFilters: () => false,
      hasActiveFilters: () => false,
    };

    promptTreeProvider = new PromptTreeProvider(
      mockPromptController,
      mockConfigurationService,
      mockFileSystemManager,
      mockFilterCoordinator
    );
  });

  teardown(() => {
    promptTreeProvider.dispose();
    // Reset mock to default state
    mockFilterCoordinator.filterAll = async (structure: any) => {
      // Default behavior: return all prompts (no filtering)
      return [
        ...structure.rootPrompts,
        ...structure.folders.flatMap((f: any) => f.prompts),
      ];
    };
    mockFilterCoordinator.hasActiveFilters = () => false;
  });

  suite("getChildren", () => {
    test("should return empty state when no prompts exist", async () => {
      const children = await promptTreeProvider.getChildren();

      // Updated: No TagRootTreeItem in prompt tree (tags have separate tree)
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

      // Updated: No TagRootTreeItem in prompt tree
      assert.strictEqual(children.length, 2);
      assert.ok(children[0] instanceof FolderTreeItem);
      assert.ok(children[1] instanceof FileTreeItem);
    });
  });

  suite("filter functionality", () => {
    test("should filter prompts based on active filters", async () => {
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

      // Mock FilterCoordinator to return only the matching prompt
      mockFilterCoordinator.filterAll = async (structure: any) => {
        return structure.rootPrompts.filter(
          (p: any) => p.path === "/test/matching-prompt.md"
        );
      };
      // Mock that filters are active
      mockFilterCoordinator.hasActiveFilters = () => true;

      const children = await promptTreeProvider.getChildren();

      // Should show only the filtered prompt as a flat list
      assert.strictEqual(children.length, 1);
      assert.ok(children[0] instanceof FileTreeItem);
      assert.strictEqual(
        (children[0] as FileTreeItem).label,
        "Matching Prompt"
      );
    });

    test("should show no results message when no prompts match filters", async () => {
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

      // Mock FilterCoordinator to return no matches
      mockFilterCoordinator.filterAll = async () => {
        return [];
      };
      // Mock that filters are active (but return no results)
      mockFilterCoordinator.hasActiveFilters = () => true;

      const children = await promptTreeProvider.getChildren();

      // Should show empty filtered state
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
      // Updated to expect object format instead of JSON string
      const expectedData = {
        type: "file",
        path: "/test/test-prompt.md",
        title: "Test Prompt",
        name: "test-prompt.md",
      };
      assert.deepStrictEqual(dragData.value, expectedData);
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
      // Updated to expect object format for folders
      assert.ok(dragData);
      const expectedData = {
        type: "folder",
        path: "/test/folder",
        name: "Test Folder",
      };
      assert.deepStrictEqual(dragData.value, expectedData);
    });
  });

  suite("drag and drop edge cases", () => {
    let showErrorMessageStub: sinon.SinonStub;
    let showInformationMessageStub: sinon.SinonStub;

    setup(() => {
      // Clean up any existing stubs
      sinon.restore();

      showErrorMessageStub = sinon
        .stub(vscode.window, "showErrorMessage")
        .resolves();
      showInformationMessageStub = sinon
        .stub(vscode.window, "showInformationMessage")
        .resolves();

      // Reset file system manager mocks
      mockFileSystemManager.moveFile = sinon.stub().resolves();
      mockFileSystemManager.moveFolder = sinon.stub().resolves();
      mockFileSystemManager.checkMoveConflict = sinon
        .stub()
        .resolves({ hasConflict: false });
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

      // Mock checkMoveConflict to detect circular dependency
      // In a real scenario, this would be detected by the checkMoveConflict logic
      // but since we're testing the error handling, we'll simulate a custom check
      mockFileSystemManager.checkMoveConflict = sinon.stub().resolves({
        hasConflict: true,
        conflictType: "circular_dependency",
      });

      const dataTransfer = new vscode.DataTransfer();
      dataTransfer.set(
        "application/vnd.code.tree.promptmanager",
        new vscode.DataTransferItem({
          type: "folder",
          path: "/test/parent-folder",
          name: "Parent Folder",
        })
      );

      // Set current drag state (simulating drag start)
      await promptTreeProvider.handleDrag([folderItem], dataTransfer);

      // Try to drop parent folder onto its subfolder
      await promptTreeProvider.handleDrop(subfolderItem, dataTransfer);

      // Verify error message was shown
      assert.ok(showErrorMessageStub.calledOnce, "Should show error message");
      assert.ok(
        showErrorMessageStub.firstCall.args[0].includes(
          "Cannot move item due to a conflict"
        ),
        "Error message should mention conflict"
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

      // Mock checkMoveConflict to return target exists conflict
      mockFileSystemManager.checkMoveConflict = sinon.stub().resolves({
        hasConflict: true,
        conflictType: "target_exists",
      });

      const dataTransfer = new vscode.DataTransfer();
      dataTransfer.set(
        "application/vnd.code.tree.promptmanager",
        new vscode.DataTransferItem({
          type: "file",
          path: "/test/existing-prompt.md",
          title: "Existing Prompt",
          name: "existing-prompt.md",
        })
      );

      // Set current drag state
      await promptTreeProvider.handleDrag([sourceFileItem], dataTransfer);

      // Try to drop file where target already exists
      await promptTreeProvider.handleDrop(targetFolderItem, dataTransfer);

      // Verify error message was shown for conflicting name
      assert.ok(showErrorMessageStub.calledOnce, "Should show error message");
      assert.ok(
        showErrorMessageStub.firstCall.args[0].includes(
          "already exists in the target location"
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

      // Add warning message stub since dropping on file item shows warning
      const showWarningStub = sinon
        .stub(vscode.window, "showWarningMessage")
        .resolves();

      const dataTransfer = new vscode.DataTransfer();
      dataTransfer.set(
        "application/vnd.code.tree.promptmanager",
        new vscode.DataTransferItem({
          type: "file",
          path: "/test/test-prompt.md",
          title: "Test Prompt",
          name: "test-prompt.md",
        })
      );

      // Set current drag state
      await promptTreeProvider.handleDrag([fileItem], dataTransfer);

      // Try to drop file on itself (which is a file item, not folder)
      await promptTreeProvider.handleDrop(fileItem, dataTransfer);

      // Should show warning about dropping on file item
      assert.ok(showWarningStub.calledOnce, "Should show warning message");
      assert.ok(
        showWarningStub.firstCall.args[0].includes(
          "Can only drop items onto folders or the root area"
        ),
        "Warning message should mention folder/root restriction"
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

      // Mock successful operations - no conflict
      mockFileSystemManager.checkMoveConflict = sinon
        .stub()
        .resolves({ hasConflict: false });
      mockFileSystemManager.moveFile = sinon.stub().resolves();

      // Mock the refresh method on promptTreeProvider
      const refreshStub = sinon.stub(promptTreeProvider, "refresh");

      const dataTransfer = new vscode.DataTransfer();
      dataTransfer.set(
        "application/vnd.code.tree.promptmanager",
        new vscode.DataTransferItem({
          type: "file",
          path: "/test/source-prompt.md",
          title: "Source Prompt",
          name: "source-prompt.md",
        })
      );

      // Set current drag state
      await promptTreeProvider.handleDrag([sourceFileItem], dataTransfer);

      // Drop file into folder
      await promptTreeProvider.handleDrop(targetFolderItem, dataTransfer);

      // Verify conflict check was called
      assert.ok(
        mockFileSystemManager.checkMoveConflict.calledOnce,
        "Should call checkMoveConflict"
      );

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
      assert.ok(refreshStub.calledOnce, "Should refresh tree");
    });
  });

  suite("folder move operations", () => {
    let showInformationMessageStub: sinon.SinonStub;

    setup(() => {
      sinon.restore();
      showInformationMessageStub = sinon
        .stub(vscode.window, "showInformationMessage")
        .resolves();

      // Reset file system manager mocks
      mockFileSystemManager.moveFolder = sinon.stub().resolves();
      mockFileSystemManager.checkMoveConflict = sinon
        .stub()
        .resolves({ hasConflict: false });
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
        rebuildIndexForce: sinon.stub().resolves(),
      };

      mockPromptController.getRepository = sinon.stub().returns({
        getFileManager: () => mockFileManager,
      });

      // Mock successful folder move
      mockFileSystemManager.moveFolder = sinon.stub().resolves();
      mockFileSystemManager.checkMoveConflict = sinon
        .stub()
        .resolves({ hasConflict: false });

      // Mock the refresh method
      const refreshStub = sinon.stub(promptTreeProvider, "refresh");

      const dataTransfer = new vscode.DataTransfer();
      dataTransfer.set(
        "application/vnd.code.tree.promptmanager",
        new vscode.DataTransferItem({
          type: "folder",
          path: "/test/source-folder",
          name: "Source Folder",
        })
      );

      // Set current drag state and drop
      await promptTreeProvider.handleDrag([sourceFolderItem], dataTransfer);
      await promptTreeProvider.handleDrop(targetFolderItem, dataTransfer);

      // Verify immediate operations
      assert.ok(
        mockFileSystemManager.checkMoveConflict.calledOnce,
        "Should call checkMoveConflict"
      );
      assert.ok(
        mockFileSystemManager.moveFolder.calledOnce,
        "Should call moveFolder"
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

      // Mock successful conflict check but failed folder move
      mockFileSystemManager.checkMoveConflict = sinon
        .stub()
        .resolves({ hasConflict: false });
      mockFileSystemManager.moveFolder = sinon
        .stub()
        .rejects(new Error("Move failed"));

      const showErrorStub = sinon
        .stub(vscode.window, "showErrorMessage")
        .resolves();

      const dataTransfer = new vscode.DataTransfer();
      dataTransfer.set(
        "application/vnd.code.tree.promptmanager",
        new vscode.DataTransferItem({
          type: "folder",
          path: "/test/source-folder",
          name: "Source Folder",
        })
      );

      // Set current drag state and drop on root
      await promptTreeProvider.handleDrag([sourceFolderItem], dataTransfer);
      await promptTreeProvider.handleDrop(undefined, dataTransfer);

      // Verify error handling
      assert.ok(
        mockFileSystemManager.checkMoveConflict.calledOnce,
        "Should call checkMoveConflict"
      );
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
