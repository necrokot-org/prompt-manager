import { afterEach, beforeEach, describe, it } from "mocha";
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

describe("CommandHandler", () => {
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

  beforeEach(() => {
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

    // Create CommandHandler instance
    commandHandler = new CommandHandler(mockPromptController, mockContext);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("registerCommands()", () => {
    it("should register all expected commands", () => {
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
      ];

      expectedCommands.forEach((commandId) => {
        expect(vscodeStubs.commands.calledWith(commandId)).to.be.true;
      });

      // Should register 11 commands total
      expect(vscodeStubs.commands.callCount).to.equal(11);
    });

    it("should add all commands to extension subscriptions", () => {
      // Mock the return value of registerCommand
      const mockDisposable = { dispose: sinon.stub() };
      vscodeStubs.commands.returns(mockDisposable);

      commandHandler.registerCommands();

      // All commands should be added to subscriptions for cleanup
      expect(mockContext.subscriptions).to.have.lengthOf(11);
      expect(mockContext.subscriptions.every((sub) => sub === mockDisposable))
        .to.be.true;
    });
  });

  describe("refreshTree command", () => {
    let eventBusSpy: sinon.SinonSpy;

    beforeEach(() => {
      eventBusSpy = sinon.spy(eventBus, "emit");

      // Setup command handler
      commandHandler.registerCommands();
    });

    it("should emit tree refresh event and show success message", async () => {
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

    it("should show error message when refresh fails", async () => {
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

  describe("addPrompt command", () => {
    it("should call controller createNewPrompt method", async () => {
      commandHandler.registerCommands();

      const addPromptHandler = vscodeStubs.commands
        .getCalls()
        .find((call) => call.args[0] === "promptManager.addPrompt")?.args[1];

      expect(addPromptHandler).to.exist;

      mockPromptController.createNewPrompt.resolves();

      await addPromptHandler();

      expect(mockPromptController.createNewPrompt.calledOnce).to.be.true;
    });

    it("should show error message when createNewPrompt fails", async () => {
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

  describe("openPrompt command", () => {
    it("should call controller openPromptFile with provided path", async () => {
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

    it("should show error when no file path provided", async () => {
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

    it("should emit prompt opened event on success", async () => {
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

    it("should show error message when openPromptFile fails", async () => {
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

  describe("deletePrompt command", () => {
    let mockFileTreeItem: FileTreeItem;
    let eventBusSpy: sinon.SinonSpy;

    beforeEach(() => {
      eventBusSpy = sinon.spy(eventBus, "emit");

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

    it("should delete file and emit event", async () => {
      commandHandler.registerCommands();

      const deleteHandler = vscodeStubs.commands
        .getCalls()
        .find((call) => call.args[0] === "promptManager.deletePrompt")?.args[1];

      mockPromptController.deletePromptFile.resolves();

      await deleteHandler(mockFileTreeItem);

      expect(
        mockPromptController.deletePromptFile.calledWith("/test/prompt.md")
      ).to.be.true;
      expect(
        eventBusSpy.calledWith("filesystem.file.deleted", {
          filePath: "/test/prompt.md",
          fileName: "prompt.md",
        })
      ).to.be.true;
    });

    it("should show error when no item provided", async () => {
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

    it("should show error message when delete fails", async () => {
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

  describe("createFolder command", () => {
    let mockFolderTreeItem: FolderTreeItem;

    beforeEach(() => {
      // Create mock FolderTreeItem
      const mockPromptFolder: PromptFolder = {
        name: "Test Folder",
        path: "/test/folder",
        prompts: [],
      };

      mockFolderTreeItem = new FolderTreeItem(mockPromptFolder);
    });

    it("should create folder in specified location", async () => {
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

    it("should create folder at root when no item provided", async () => {
      commandHandler.registerCommands();

      const createFolderHandler = vscodeStubs.commands
        .getCalls()
        .find((call) => call.args[0] === "promptManager.createFolder")?.args[1];

      mockPromptController.createFolderInLocation.resolves();

      await createFolderHandler(); // No item provided

      expect(mockPromptController.createFolderInLocation.calledWith(undefined))
        .to.be.true;
    });

    it("should show error message when create folder fails", async () => {
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

  describe("copyPromptContent command", () => {
    let mockFileTreeItem: FileTreeItem;

    beforeEach(() => {
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

    it("should copy content and show success message", async () => {
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

    it("should not show message when copy returns false", async () => {
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

    it("should show error when no item provided", async () => {
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

    it("should show error message when copy fails", async () => {
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

  describe("copyPromptWithMeta command", () => {
    let mockFileTreeItem: FileTreeItem;

    beforeEach(() => {
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

    it("should copy content with meta and show success message", async () => {
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

    it("should not show message when copy returns false", async () => {
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

    it("should show error when no item provided", async () => {
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

    it("should show error message when copy fails", async () => {
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

  describe("deleteFolder command", () => {
    let mockFolderTreeItem: FolderTreeItem;

    beforeEach(() => {
      const mockPromptFolder: PromptFolder = {
        name: "test-folder",
        path: "/test/test-folder",
        prompts: [],
      };

      mockFolderTreeItem = new FolderTreeItem(mockPromptFolder);
    });

    it("should delete folder and emit event", async () => {
      commandHandler.registerCommands();

      const deleteFolderHandler = vscodeStubs.commands
        .getCalls()
        .find((call) => call.args[0] === "promptManager.deleteFolder")?.args[1];

      const eventBusSpy = sinon.spy(eventBus, "emit");
      mockPromptController.deleteFolderWithContents.resolves();

      await deleteFolderHandler(mockFolderTreeItem);

      expect(
        mockPromptController.deleteFolderWithContents.calledWith(
          "/test/test-folder"
        )
      ).to.be.true;
      expect(
        eventBusSpy.calledWith("filesystem.file.deleted", {
          filePath: "/test/test-folder",
          fileName: "test-folder",
        })
      ).to.be.true;

      eventBusSpy.restore();
    });

    it("should show error when no folder selected", async () => {
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

    it("should show error message when delete fails", async () => {
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

  describe("askAiWithPrompt command", () => {
    let mockFileTreeItem: FileTreeItem;

    beforeEach(() => {
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

    it("should get prompt and execute chat command", async () => {
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

    it("should show error when no item provided", async () => {
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

    it("should return early when prompt is null", async () => {
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

    it("should show error message when ask AI fails", async () => {
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

  describe("openDirectory command", () => {
    it("should open directory when path exists", async () => {
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
        (vscode.commands.executeCommand as sinon.SinonStub).calledWith(
          "vscode.openFolder",
          sinon.match.any,
          { forceNewWindow: false }
        )
      ).to.be.true;
    });

    it("should show error when no directory found", async () => {
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

    it("should show error message when open directory fails", async () => {
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

  describe("addPromptToFolder command", () => {
    let mockFolderTreeItem: FolderTreeItem;

    beforeEach(() => {
      const mockPromptFolder: PromptFolder = {
        name: "Test Folder",
        path: "/test/folder",
        prompts: [],
      };

      mockFolderTreeItem = new FolderTreeItem(mockPromptFolder);
    });

    it("should create prompt in specified folder", async () => {
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

    it("should show error when no folder selected", async () => {
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

    it("should show error message when add to folder fails", async () => {
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
