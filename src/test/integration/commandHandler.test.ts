import { setup, teardown, suite, test } from "mocha";
import { expect } from "chai";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { CommandHandler } from "../../extension/commands/commandHandler";
import { PromptController } from "../../features/prompt-manager/domain/promptController";
import {
  FileTreeItem,
  FolderTreeItem,
} from "../../features/prompt-manager/ui/tree/items";
import { eventBus } from "../../infrastructure/vscode/ExtensionBus";
import { PromptFile, PromptFolder } from "../../scanner/types";

suite("CommandHandler", () => {
  let commandHandler: CommandHandler;
  let mockPromptController: sinon.SinonStubbedInstance<PromptController>;
  let mockContext: vscode.ExtensionContext;
  let vscodeStubs: {
    commands: sinon.SinonStub;
    window: {
      showInformationMessage: sinon.SinonStub;
      showErrorMessage: sinon.SinonStub;
    };
  };

  setup(() => {
    // Mock PromptController
    mockPromptController = sinon.createStubInstance(PromptController);

    // Mock extension context
    mockContext = {
      subscriptions: [],
    } as any;

    // Mock vscode API
    vscodeStubs = {
      commands: sinon.stub(vscode.commands, "registerCommand"),
      window: {
        showInformationMessage: sinon.stub(
          vscode.window,
          "showInformationMessage"
        ),
        showErrorMessage: sinon.stub(vscode.window, "showErrorMessage"),
      },
    };

    // Mock additional vscode commands that might be called
    sinon.stub(vscode.commands, "executeCommand");
    sinon.stub(vscode.Uri, "file").returns({ fsPath: "/mock/path" } as any);
    sinon.stub(vscode.env, "openExternal").resolves(true);

    // Create CommandHandler instance
    const mockTagService = {} as any;
    commandHandler = new CommandHandler(
      mockPromptController,
      mockContext,
      mockTagService
    );
  });

  teardown(() => {
    sinon.restore();
  });

  suite("registerCommands()", () => {
    test("should register all expected commands", () => {
      commandHandler.registerCommands();

      // Verify all commands are registered
      const expectedCommands = [
        "promptManager.refreshTree",
        "promptManager.addPrompt",
        "promptManager.openPrompt",
        "promptManager.deletePrompt",
        "promptManager.createFolder",
        "promptManager.openDirectory",
        "promptManager.addPromptToFolder",
        "promptManager.copyPromptContent",
        "promptManager.copyPromptWithMeta",
        "promptManager.deleteFolder",
        "promptManager.askAiWithPrompt",
        // Tag commands
        "promptManager.selectTag",
        "promptManager.clearTagFilter",
        "promptManager.renameTag",
        "promptManager.deleteTag",
      ];

      expectedCommands.forEach((commandId) => {
        expect(vscodeStubs.commands.calledWith(commandId)).to.be.true;
      });

      // Should register 15 commands total
      expect(vscodeStubs.commands.callCount).to.equal(15);
    });

    test("should add all commands to extension subscriptions", () => {
      // Mock the return value of registerCommand
      const mockDisposable = { dispose: sinon.stub() };
      vscodeStubs.commands.returns(mockDisposable);

      commandHandler.registerCommands();

      // All commands should be added to subscriptions for cleanup
      expect(mockContext.subscriptions).to.have.lengthOf(15);
      expect(mockContext.subscriptions.every((sub) => sub === mockDisposable))
        .to.be.true;
    });
  });

  suite("refreshTree command", () => {
    let eventBusSpy: sinon.SinonSpy;

    setup(() => {
      eventBusSpy = sinon.spy(eventBus, "emit");

      // Setup command handler
      commandHandler.registerCommands();
    });

    test("should emit tree refresh event and show success message", async () => {
      // Get the refresh command handler
      const refreshHandler = vscodeStubs.commands
        .getCalls()
        .find((call) => call.args[0] === "promptManager.refreshTree")?.args[1];

      expect(refreshHandler).to.exist;

      // Call the handler
      await refreshHandler();

      // Verify event was emitted
      expect(
        eventBusSpy.calledWith("ui.tree.refresh.requested", {
          reason: "manual",
        })
      ).to.be.true;

      // Verify success message
      expect(
        vscodeStubs.window.showInformationMessage.calledWith(
          "Prompt Manager tree refreshed"
        )
      ).to.be.true;
    });

    test("should show error message when refresh fails", async () => {
      // Make eventBus.emit throw an error
      eventBusSpy.restore();
      sinon.stub(eventBus, "emit").throws(new Error("Event bus error"));

      const refreshHandler = vscodeStubs.commands
        .getCalls()
        .find((call) => call.args[0] === "promptManager.refreshTree")?.args[1];

      await refreshHandler();

      // Should show error message
      expect(
        vscodeStubs.window.showErrorMessage.calledWith(
          sinon.match("Failed to refresh tree:")
        )
      ).to.be.true;
    });
  });

  suite("addPrompt command", () => {
    test("should call controller createNewPrompt method", async () => {
      commandHandler.registerCommands();

      const addPromptHandler = vscodeStubs.commands
        .getCalls()
        .find((call) => call.args[0] === "promptManager.addPrompt")?.args[1];

      expect(addPromptHandler).to.exist;

      mockPromptController.createNewPrompt.resolves();

      await addPromptHandler();

      expect(mockPromptController.createNewPrompt.calledOnce).to.be.true;
    });

    test("should show error message when createNewPrompt fails", async () => {
      commandHandler.registerCommands();

      const addPromptHandler = vscodeStubs.commands
        .getCalls()
        .find((call) => call.args[0] === "promptManager.addPrompt")?.args[1];

      const error = new Error("Failed to create prompt");
      mockPromptController.createNewPrompt.rejects(error);

      await addPromptHandler();

      expect(
        vscodeStubs.window.showErrorMessage.calledWith(
          "Failed to add prompt: Error: Failed to create prompt"
        )
      ).to.be.true;
    });
  });

  suite("openPrompt command", () => {
    test("should call controller openPromptFile with provided path", async () => {
      commandHandler.registerCommands();

      const openPromptHandler = vscodeStubs.commands
        .getCalls()
        .find((call) => call.args[0] === "promptManager.openPrompt")?.args[1];

      const testPath = "/test/prompt.md";
      mockPromptController.openPromptFile.resolves();

      await openPromptHandler(testPath);

      expect(mockPromptController.openPromptFile.calledWith(testPath)).to.be
        .true;
    });

    test("should show error when no file path provided", async () => {
      commandHandler.registerCommands();

      const openPromptHandler = vscodeStubs.commands
        .getCalls()
        .find((call) => call.args[0] === "promptManager.openPrompt")?.args[1];

      await openPromptHandler(); // No path provided

      expect(
        vscodeStubs.window.showErrorMessage.calledWith(
          "No file path provided to open prompt"
        )
      ).to.be.true;
    });

    test("should emit prompt opened event on success", async () => {
      const eventBusSpy = sinon.spy(eventBus, "emit");
      commandHandler.registerCommands();

      const openPromptHandler = vscodeStubs.commands
        .getCalls()
        .find((call) => call.args[0] === "promptManager.openPrompt")?.args[1];

      const testPath = "/test/prompt.md";
      mockPromptController.openPromptFile.resolves();

      await openPromptHandler(testPath);

      // Should emit prompt opened event
      expect(eventBusSpy.called).to.be.true;
    });

    test("should show error message when openPromptFile fails", async () => {
      commandHandler.registerCommands();

      const openPromptHandler = vscodeStubs.commands
        .getCalls()
        .find((call) => call.args[0] === "promptManager.openPrompt")?.args[1];

      const testPath = "/test/prompt.md";
      const error = new Error("File not found");
      mockPromptController.openPromptFile.rejects(error);

      await openPromptHandler(testPath);

      expect(
        vscodeStubs.window.showErrorMessage.calledWith(
          "Failed to open prompt: Error: File not found"
        )
      ).to.be.true;
    });
  });

  suite("deletePrompt command", () => {
    let mockFileTreeItem: FileTreeItem;

    setup(() => {
      // Create mock FileTreeItem
      const mockPromptFile: PromptFile = {
        name: "prompt.md",
        path: "/test/prompt.md",
        title: "Test Prompt",
        description: "",
        tags: [],
        fileSize: 100,
        isDirectory: false,
      };

      mockFileTreeItem = new FileTreeItem(mockPromptFile);
    });

    test("should delete file via controller", async () => {
      commandHandler.registerCommands();

      const deleteHandler = vscodeStubs.commands
        .getCalls()
        .find((call) => call.args[0] === "promptManager.deletePrompt")?.args[1];

      mockPromptController.deletePromptFile.resolves();

      await deleteHandler(mockFileTreeItem);

      expect(
        mockPromptController.deletePromptFile.calledWith("/test/prompt.md")
      ).to.be.true;
    });

    test("should show error when no item provided", async () => {
      commandHandler.registerCommands();

      const deleteHandler = vscodeStubs.commands
        .getCalls()
        .find((call) => call.args[0] === "promptManager.deletePrompt")?.args[1];

      await deleteHandler(); // No item provided

      expect(
        vscodeStubs.window.showErrorMessage.calledWith(
          "No prompt selected for deletion"
        )
      ).to.be.true;
    });

    test("should show error message when delete fails", async () => {
      commandHandler.registerCommands();

      const deleteHandler = vscodeStubs.commands
        .getCalls()
        .find((call) => call.args[0] === "promptManager.deletePrompt")?.args[1];

      const error = new Error("Delete failed");
      mockPromptController.deletePromptFile.rejects(error);

      await deleteHandler(mockFileTreeItem);

      expect(
        vscodeStubs.window.showErrorMessage.calledWith(
          "Failed to delete prompt: Error: Delete failed"
        )
      ).to.be.true;
    });
  });

  suite("createFolder command", () => {
    let mockFolderTreeItem: FolderTreeItem;

    setup(() => {
      // Create mock FolderTreeItem
      const mockPromptFolder: PromptFolder = {
        name: "Test Folder",
        path: "/test/folder",
        prompts: [],
      };

      mockFolderTreeItem = new FolderTreeItem(mockPromptFolder);
    });

    test("should create folder in specified location", async () => {
      commandHandler.registerCommands();

      const createFolderHandler = vscodeStubs.commands
        .getCalls()
        .find((call) => call.args[0] === "promptManager.createFolder")?.args[1];

      mockPromptController.createFolderInLocation.resolves();

      await createFolderHandler(mockFolderTreeItem);

      expect(
        mockPromptController.createFolderInLocation.calledWith("/test/folder")
      ).to.be.true;
    });

    test("should create folder at root when no item provided", async () => {
      commandHandler.registerCommands();

      const createFolderHandler = vscodeStubs.commands
        .getCalls()
        .find((call) => call.args[0] === "promptManager.createFolder")?.args[1];

      mockPromptController.createFolderInLocation.resolves();

      await createFolderHandler(); // No item provided

      expect(mockPromptController.createFolderInLocation.calledWith(undefined))
        .to.be.true;
    });

    test("should show error message when create folder fails", async () => {
      commandHandler.registerCommands();

      const createFolderHandler = vscodeStubs.commands
        .getCalls()
        .find((call) => call.args[0] === "promptManager.createFolder")?.args[1];

      const error = new Error("Folder creation failed");
      mockPromptController.createFolderInLocation.rejects(error);

      await createFolderHandler(mockFolderTreeItem);

      expect(
        vscodeStubs.window.showErrorMessage.calledWith(
          "Failed to create folder: Error: Folder creation failed"
        )
      ).to.be.true;
    });
  });

  suite("copyPromptContent command", () => {
    let mockFileTreeItem: FileTreeItem;

    setup(() => {
      const mockPromptFile: PromptFile = {
        name: "prompt.md",
        path: "/test/prompt.md",
        title: "Test Prompt",
        description: "",
        tags: [],
        fileSize: 100,
        isDirectory: false,
      };

      mockFileTreeItem = new FileTreeItem(mockPromptFile);
    });

    test("should copy content and show success message", async () => {
      commandHandler.registerCommands();

      const copyHandler = vscodeStubs.commands
        .getCalls()
        .find((call) => call.args[0] === "promptManager.copyPromptContent")
        ?.args[1];

      mockPromptController.copyPromptContentToClipboard.resolves(true);

      await copyHandler(mockFileTreeItem);

      expect(
        mockPromptController.copyPromptContentToClipboard.calledWith(
          "/test/prompt.md"
        )
      ).to.be.true;
      expect(
        vscodeStubs.window.showInformationMessage.calledWith(
          'Copied content from "Test Prompt" (without meta)'
        )
      ).to.be.true;
    });

    test("should not show message when copy returns false", async () => {
      commandHandler.registerCommands();

      const copyHandler = vscodeStubs.commands
        .getCalls()
        .find((call) => call.args[0] === "promptManager.copyPromptContent")
        ?.args[1];

      mockPromptController.copyPromptContentToClipboard.resolves(false);

      await copyHandler(mockFileTreeItem);

      expect(
        mockPromptController.copyPromptContentToClipboard.calledWith(
          "/test/prompt.md"
        )
      ).to.be.true;
      expect(vscodeStubs.window.showInformationMessage.called).to.be.false;
    });

    test("should show error when no item provided", async () => {
      commandHandler.registerCommands();

      const copyHandler = vscodeStubs.commands
        .getCalls()
        .find((call) => call.args[0] === "promptManager.copyPromptContent")
        ?.args[1];

      await copyHandler(); // No item provided

      expect(
        vscodeStubs.window.showErrorMessage.calledWith(
          "No prompt selected for copying"
        )
      ).to.be.true;
    });

    test("should show error message when copy fails", async () => {
      commandHandler.registerCommands();

      const copyHandler = vscodeStubs.commands
        .getCalls()
        .find((call) => call.args[0] === "promptManager.copyPromptContent")
        ?.args[1];

      const error = new Error("Copy failed");
      mockPromptController.copyPromptContentToClipboard.rejects(error);

      await copyHandler(mockFileTreeItem);

      expect(
        vscodeStubs.window.showErrorMessage.calledWith(
          "Failed to copy prompt content: Error: Copy failed"
        )
      ).to.be.true;
    });
  });

  suite("copyPromptWithMeta command", () => {
    let mockFileTreeItem: FileTreeItem;

    setup(() => {
      const mockPromptFile: PromptFile = {
        name: "prompt.md",
        path: "/test/prompt.md",
        title: "Test Prompt",
        description: "",
        tags: [],
        fileSize: 100,
        isDirectory: false,
      };

      mockFileTreeItem = new FileTreeItem(mockPromptFile);
    });

    test("should copy content with meta and show success message", async () => {
      commandHandler.registerCommands();

      const copyHandler = vscodeStubs.commands
        .getCalls()
        .find((call) => call.args[0] === "promptManager.copyPromptWithMeta")
        ?.args[1];

      mockPromptController.copyPromptWithMetaToClipboard.resolves(true);

      await copyHandler(mockFileTreeItem);

      expect(
        mockPromptController.copyPromptWithMetaToClipboard.calledWith(
          "/test/prompt.md"
        )
      ).to.be.true;
      expect(
        vscodeStubs.window.showInformationMessage.calledWith(
          'Copied content from "Test Prompt" (with meta)'
        )
      ).to.be.true;
    });

    test("should not show message when copy returns false", async () => {
      commandHandler.registerCommands();

      const copyHandler = vscodeStubs.commands
        .getCalls()
        .find((call) => call.args[0] === "promptManager.copyPromptWithMeta")
        ?.args[1];

      mockPromptController.copyPromptWithMetaToClipboard.resolves(false);

      await copyHandler(mockFileTreeItem);

      expect(
        mockPromptController.copyPromptWithMetaToClipboard.calledWith(
          "/test/prompt.md"
        )
      ).to.be.true;
      expect(vscodeStubs.window.showInformationMessage.called).to.be.false;
    });

    test("should show error when no item provided", async () => {
      commandHandler.registerCommands();

      const copyHandler = vscodeStubs.commands
        .getCalls()
        .find((call) => call.args[0] === "promptManager.copyPromptWithMeta")
        ?.args[1];

      await copyHandler(); // No item provided

      expect(
        vscodeStubs.window.showErrorMessage.calledWith(
          "No prompt selected for copying"
        )
      ).to.be.true;
    });

    test("should show error message when copy fails", async () => {
      commandHandler.registerCommands();

      const copyHandler = vscodeStubs.commands
        .getCalls()
        .find((call) => call.args[0] === "promptManager.copyPromptWithMeta")
        ?.args[1];

      const error = new Error("Copy failed");
      mockPromptController.copyPromptWithMetaToClipboard.rejects(error);

      await copyHandler(mockFileTreeItem);

      expect(
        vscodeStubs.window.showErrorMessage.calledWith(
          "Failed to copy prompt with meta: Error: Copy failed"
        )
      ).to.be.true;
    });
  });

  suite("deleteFolder command", () => {
    let mockFolderTreeItem: FolderTreeItem;

    setup(() => {
      const mockPromptFolder: PromptFolder = {
        name: "test-folder",
        path: "/test/test-folder",
        prompts: [],
      };

      mockFolderTreeItem = new FolderTreeItem(mockPromptFolder);
    });

    test("should delete folder via controller", async () => {
      commandHandler.registerCommands();

      const deleteFolderHandler = vscodeStubs.commands
        .getCalls()
        .find((call) => call.args[0] === "promptManager.deleteFolder")?.args[1];

      mockPromptController.deleteFolderWithContents.resolves();

      await deleteFolderHandler(mockFolderTreeItem);

      expect(
        mockPromptController.deleteFolderWithContents.calledWith(
          "/test/test-folder"
        )
      ).to.be.true;
    });

    test("should show error when no folder selected", async () => {
      commandHandler.registerCommands();

      const deleteFolderHandler = vscodeStubs.commands
        .getCalls()
        .find((call) => call.args[0] === "promptManager.deleteFolder")?.args[1];

      await deleteFolderHandler(); // No item provided

      expect(
        vscodeStubs.window.showErrorMessage.calledWith(
          "No folder selected for deletion"
        )
      ).to.be.true;
    });

    test("should show error message when delete fails", async () => {
      commandHandler.registerCommands();

      const deleteFolderHandler = vscodeStubs.commands
        .getCalls()
        .find((call) => call.args[0] === "promptManager.deleteFolder")?.args[1];

      const error = new Error("Delete failed");
      mockPromptController.deleteFolderWithContents.rejects(error);

      await deleteFolderHandler(mockFolderTreeItem);

      expect(
        vscodeStubs.window.showErrorMessage.calledWith(
          "Failed to delete folder: Error: Delete failed"
        )
      ).to.be.true;
    });
  });

  suite("askAiWithPrompt command", () => {
    let mockFileTreeItem: FileTreeItem;

    setup(() => {
      const mockPromptFile: PromptFile = {
        name: "prompt.md",
        path: "/test/prompt.md",
        title: "Test Prompt",
        description: "",
        tags: [],
        fileSize: 100,
        isDirectory: false,
      };

      mockFileTreeItem = new FileTreeItem(mockPromptFile);
    });

    test("should get prompt and execute chat command", async () => {
      commandHandler.registerCommands();

      const askAiHandler = vscodeStubs.commands
        .getCalls()
        .find((call) => call.args[0] === "promptManager.askAiWithPrompt")
        ?.args[1];

      mockPromptController.getPrompt.resolves("Test prompt content");

      await askAiHandler(mockFileTreeItem);

      expect(mockPromptController.getPrompt.calledWith("/test/prompt.md")).to.be
        .true;
      expect(
        (vscode.commands.executeCommand as sinon.SinonStub).calledWith(
          "workbench.action.chat.open"
        )
      ).to.be.true;
    });

    test("should show error when no item provided", async () => {
      commandHandler.registerCommands();

      const askAiHandler = vscodeStubs.commands
        .getCalls()
        .find((call) => call.args[0] === "promptManager.askAiWithPrompt")
        ?.args[1];

      await askAiHandler(); // No item provided

      expect(
        vscodeStubs.window.showErrorMessage.calledWith(
          "No prompt selected to ask AI"
        )
      ).to.be.true;
    });

    test("should return early when prompt is null", async () => {
      commandHandler.registerCommands();

      const askAiHandler = vscodeStubs.commands
        .getCalls()
        .find((call) => call.args[0] === "promptManager.askAiWithPrompt")
        ?.args[1];

      mockPromptController.getPrompt.resolves(null);

      await askAiHandler(mockFileTreeItem);

      expect(mockPromptController.getPrompt.calledWith("/test/prompt.md")).to.be
        .true;
      expect((vscode.commands.executeCommand as sinon.SinonStub).called).to.be
        .false;
    });

    test("should show error message when ask AI fails", async () => {
      commandHandler.registerCommands();

      const askAiHandler = vscodeStubs.commands
        .getCalls()
        .find((call) => call.args[0] === "promptManager.askAiWithPrompt")
        ?.args[1];

      const error = new Error("AI command failed");
      mockPromptController.getPrompt.rejects(error);

      await askAiHandler(mockFileTreeItem);

      expect(
        vscodeStubs.window.showErrorMessage.calledWith(
          "Failed to ask AI: Error: AI command failed"
        )
      ).to.be.true;
    });
  });

  suite("openDirectory command", () => {
    test("should open directory when path exists", async () => {
      commandHandler.registerCommands();

      const openDirHandler = vscodeStubs.commands
        .getCalls()
        .find((call) => call.args[0] === "promptManager.openDirectory")
        ?.args[1];

      // Mock repository and file manager chain
      const mockRepository = {
        getFileManager: sinon.stub().returns({
          getPromptManagerPath: sinon.stub().returns("/test/prompt/path"),
        }),
      };
      mockPromptController.getRepository.returns(mockRepository as any);

      await openDirHandler();

      expect(
        (vscode.env.openExternal as sinon.SinonStub).calledWith(sinon.match.any)
      ).to.be.true;
    });

    test("should show error when no directory found", async () => {
      commandHandler.registerCommands();

      const openDirHandler = vscodeStubs.commands
        .getCalls()
        .find((call) => call.args[0] === "promptManager.openDirectory")
        ?.args[1];

      // Mock repository to return null path
      const mockRepository = {
        getFileManager: sinon.stub().returns({
          getPromptManagerPath: sinon.stub().returns(null),
        }),
      };
      mockPromptController.getRepository.returns(mockRepository as any);

      await openDirHandler();

      expect(
        vscodeStubs.window.showErrorMessage.calledWith(
          "No prompt directory found"
        )
      ).to.be.true;
    });

    test("should show error message when open directory fails", async () => {
      commandHandler.registerCommands();

      const openDirHandler = vscodeStubs.commands
        .getCalls()
        .find((call) => call.args[0] === "promptManager.openDirectory")
        ?.args[1];

      // Mock repository chain that throws
      const mockRepository = {
        getFileManager: sinon.stub().throws(new Error("Repository error")),
      };
      mockPromptController.getRepository.returns(mockRepository as any);

      await openDirHandler();

      expect(
        vscodeStubs.window.showErrorMessage.calledWith(
          "Failed to open directory: Error: Repository error"
        )
      ).to.be.true;
    });
  });

  suite("addPromptToFolder command", () => {
    let mockFolderTreeItem: FolderTreeItem;

    setup(() => {
      const mockPromptFolder: PromptFolder = {
        name: "Test Folder",
        path: "/test/folder",
        prompts: [],
      };

      mockFolderTreeItem = new FolderTreeItem(mockPromptFolder);
    });

    test("should create prompt in specified folder", async () => {
      commandHandler.registerCommands();

      const addToFolderHandler = vscodeStubs.commands
        .getCalls()
        .find((call) => call.args[0] === "promptManager.addPromptToFolder")
        ?.args[1];

      mockPromptController.createPromptInFolder.resolves();

      await addToFolderHandler(mockFolderTreeItem);

      expect(
        mockPromptController.createPromptInFolder.calledWith("/test/folder")
      ).to.be.true;
    });

    test("should show error when no folder selected", async () => {
      commandHandler.registerCommands();

      const addToFolderHandler = vscodeStubs.commands
        .getCalls()
        .find((call) => call.args[0] === "promptManager.addPromptToFolder")
        ?.args[1];

      await addToFolderHandler(); // No item provided

      expect(
        vscodeStubs.window.showErrorMessage.calledWith("No folder selected")
      ).to.be.true;
    });

    test("should show error message when add to folder fails", async () => {
      commandHandler.registerCommands();

      const addToFolderHandler = vscodeStubs.commands
        .getCalls()
        .find((call) => call.args[0] === "promptManager.addPromptToFolder")
        ?.args[1];

      const error = new Error("Add to folder failed");
      mockPromptController.createPromptInFolder.rejects(error);

      await addToFolderHandler(mockFolderTreeItem);

      expect(
        vscodeStubs.window.showErrorMessage.calledWith(
          "Failed to add prompt to folder: Error: Add to folder failed"
        )
      ).to.be.true;
    });
  });
});
