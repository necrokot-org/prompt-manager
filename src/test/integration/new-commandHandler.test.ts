import { setup, teardown, suite, test } from "mocha";
import { expect } from "chai";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { CommandHandler } from "../../presentation/commands/CommandHandler";
import { PromptApp } from "../../application/PromptApp";
import { TagApp } from "../../application/TagApp";
import { SearchApp } from "../../application/SearchApp";
import { IndexApp } from "../../application/IndexApp";
import { Tag } from "../../domain/model/Tag";

suite("New CommandHandler", () => {
  let commandHandler: CommandHandler;
  let mockPromptApp: sinon.SinonStubbedInstance<PromptApp>;
  let mockTagApp: sinon.SinonStubbedInstance<TagApp>;
  let mockSearchApp: sinon.SinonStubbedInstance<SearchApp>;
  let mockIndexApp: sinon.SinonStubbedInstance<IndexApp>;
  let mockContext: vscode.ExtensionContext;
  let vscodeStubs: {
    commands: sinon.SinonStub;
    window: {
      showInformationMessage: sinon.SinonStub;
      showErrorMessage: sinon.SinonStub;
      showWarningMessage: sinon.SinonStub;
      showInputBox: sinon.SinonStub;
    };
  };

  setup(() => {
    // Mock application services
    mockPromptApp = sinon.createStubInstance(PromptApp);
    mockTagApp = sinon.createStubInstance(TagApp);
    mockSearchApp = sinon.createStubInstance(SearchApp);
    mockIndexApp = sinon.createStubInstance(IndexApp);

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
        showWarningMessage: sinon.stub(vscode.window, "showWarningMessage"),
        showInputBox: sinon.stub(vscode.window, "showInputBox"),
      },
    };

    // Mock additional vscode methods
    sinon.stub(vscode.commands, "executeCommand");
    sinon.stub(vscode.workspace, "openTextDocument").resolves({} as any);
    sinon.stub(vscode.window, "showTextDocument").resolves({} as any);
    sinon.stub(vscode.env, "clipboard").get(() => ({
      writeText: sinon.stub().resolves(),
    }));

    // Create CommandHandler instance
    commandHandler = new CommandHandler(
      mockPromptApp,
      mockTagApp,
      mockSearchApp,
      mockIndexApp
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
        "promptManager.selectTag",
        "promptManager.clearTagFilter",
      ];

      expectedCommands.forEach((commandId) => {
        expect(vscodeStubs.commands.calledWith(commandId)).to.be.true;
      });

      // Should register 12 commands total
      expect(vscodeStubs.commands.callCount).to.equal(12);
    });

    test("should add all commands to extension subscriptions", () => {
      // Mock the return value of registerCommand
      const mockDisposable = { dispose: sinon.stub() };
      vscodeStubs.commands.returns(mockDisposable);

      commandHandler.registerCommands();

      // Should add all commands to subscriptions
      expect(mockContext.subscriptions).to.have.lengthOf(12);
    });
  });

  suite("Command Handlers", () => {
    test("refreshTree should call indexApp.rebuildNow", async () => {
      commandHandler.registerCommands();

      // Find the refreshTree command
      const refreshCall = vscodeStubs.commands
        .getCalls()
        .find((call) => call.args[0] === "promptManager.refreshTree");

      expect(refreshCall).to.exist;

      // Execute the command
      await refreshCall!.args[1]();

      // Verify indexApp.rebuildNow was called
      expect(mockIndexApp.rebuildNow.calledOnce).to.be.true;
      expect(
        vscodeStubs.window.showInformationMessage.calledWith(
          "Prompt Manager tree refreshed"
        )
      ).to.be.true;
    });

    test("addPrompt should create prompt with user input", async () => {
      commandHandler.registerCommands();

      // Mock user input
      vscodeStubs.window.showInputBox.resolves("Test Prompt");
      mockPromptApp.createPrompt.resolves("/test/path/Test Prompt.md");

      // Find and execute the addPrompt command
      const addPromptCall = vscodeStubs.commands
        .getCalls()
        .find((call) => call.args[0] === "promptManager.addPrompt");

      await addPromptCall!.args[1]();

      // Verify interactions
      expect(
        vscodeStubs.window.showInputBox.calledWith(
          sinon.match({ prompt: "Enter prompt name", placeHolder: "My Prompt" })
        )
      ).to.be.true;
      expect(mockPromptApp.createPrompt.calledWith("Test Prompt")).to.be.true;
      expect(
        vscodeStubs.window.showInformationMessage.calledWith(
          "Created prompt: Test Prompt"
        )
      ).to.be.true;
    });

    test("addPrompt should do nothing if user cancels", async () => {
      commandHandler.registerCommands();

      // Mock user canceling input
      vscodeStubs.window.showInputBox.resolves(undefined);

      // Find and execute the addPrompt command
      const addPromptCall = vscodeStubs.commands
        .getCalls()
        .find((call) => call.args[0] === "promptManager.addPrompt");

      await addPromptCall!.args[1]();

      // Verify no prompt was created
      expect(mockPromptApp.createPrompt.notCalled).to.be.true;
    });

    test("openPrompt should open the specified file", async () => {
      commandHandler.registerCommands();

      const testFilePath = "/test/prompt.md";

      // Find and execute the openPrompt command
      const openPromptCall = vscodeStubs.commands
        .getCalls()
        .find((call) => call.args[0] === "promptManager.openPrompt");

      await openPromptCall!.args[1](testFilePath);

      // Verify VS Code methods were called
      expect(
        (vscode.workspace.openTextDocument as any).calledWith(testFilePath)
      ).to.be.true;
      expect((vscode.window.showTextDocument as any).calledOnce).to.be.true;
    });

    test("deletePrompt should confirm and delete", async () => {
      commandHandler.registerCommands();

      const testFilePath = "/test/prompt.md";
      vscodeStubs.window.showWarningMessage.resolves("Delete");

      // Find and execute the deletePrompt command
      const deletePromptCall = vscodeStubs.commands
        .getCalls()
        .find((call) => call.args[0] === "promptManager.deletePrompt");

      await deletePromptCall!.args[1](testFilePath);

      // Verify confirmation was shown and prompt was deleted
      expect(
        vscodeStubs.window.showWarningMessage.calledWith(
          "Are you sure you want to delete this prompt?",
          { modal: true },
          "Delete"
        )
      ).to.be.true;
      expect(mockPromptApp.deletePrompt.calledWith(testFilePath)).to.be.true;
      expect(
        vscodeStubs.window.showInformationMessage.calledWith("Prompt deleted")
      ).to.be.true;
    });

    test("deletePrompt should not delete if user cancels", async () => {
      commandHandler.registerCommands();

      const testFilePath = "/test/prompt.md";
      vscodeStubs.window.showWarningMessage.resolves(undefined); // User cancels

      // Find and execute the deletePrompt command
      const deletePromptCall = vscodeStubs.commands
        .getCalls()
        .find((call) => call.args[0] === "promptManager.deletePrompt");

      await deletePromptCall!.args[1](testFilePath);

      // Verify prompt was not deleted
      expect(mockPromptApp.deletePrompt.notCalled).to.be.true;
    });

    test("createFolder should create folder with user input", async () => {
      commandHandler.registerCommands();

      vscodeStubs.window.showInputBox.resolves("Test Folder");
      mockPromptApp.createFolder.resolves("/test/folder");

      // Find and execute the createFolder command
      const createFolderCall = vscodeStubs.commands
        .getCalls()
        .find((call) => call.args[0] === "promptManager.createFolder");

      await createFolderCall!.args[1]();

      expect(
        vscodeStubs.window.showInputBox.calledWith(
          sinon.match({ prompt: "Enter folder name", placeHolder: "My Folder" })
        )
      ).to.be.true;
      expect(mockPromptApp.createFolder.calledWith("Test Folder")).to.be.true;
      expect(
        vscodeStubs.window.showInformationMessage.calledWith(
          "Created folder: Test Folder"
        )
      ).to.be.true;
    });

    test("copyPromptContent should copy content to clipboard", async () => {
      commandHandler.registerCommands();

      const testFilePath = "/test/prompt.md";
      const testContent = "Test prompt content";
      mockPromptApp.copyContent.resolves(testContent);

      // Find and execute the copyPromptContent command
      const copyContentCall = vscodeStubs.commands
        .getCalls()
        .find((call) => call.args[0] === "promptManager.copyPromptContent");

      await copyContentCall!.args[1](testFilePath);

      expect(mockPromptApp.copyContent.calledWith(testFilePath, false)).to.be
        .true;
      expect(
        vscodeStubs.window.showInformationMessage.calledWith(
          "Prompt content copied to clipboard"
        )
      ).to.be.true;
    });

    test("selectTag should select the specified tag", async () => {
      commandHandler.registerCommands();

      const testTag = Tag.from("test-tag");

      // Find and execute the selectTag command
      const selectTagCall = vscodeStubs.commands
        .getCalls()
        .find((call) => call.args[0] === "promptManager.selectTag");

      await selectTagCall!.args[1](testTag);

      expect(mockTagApp.select.calledWith(testTag)).to.be.true;
      expect(
        vscodeStubs.window.showInformationMessage.calledWith(
          "Filtering by tag: test-tag"
        )
      ).to.be.true;
    });

    test("clearTagFilter should clear active tag", async () => {
      commandHandler.registerCommands();

      // Find and execute the clearTagFilter command
      const clearTagCall = vscodeStubs.commands
        .getCalls()
        .find((call) => call.args[0] === "promptManager.clearTagFilter");

      await clearTagCall!.args[1]();

      expect(mockTagApp.clear.calledOnce).to.be.true;
      expect(
        vscodeStubs.window.showInformationMessage.calledWith(
          "Tag filter cleared"
        )
      ).to.be.true;
    });
  });

  suite("Error Handling", () => {
    test("should handle errors in addPrompt gracefully", async () => {
      commandHandler.registerCommands();

      vscodeStubs.window.showInputBox.resolves("Test Prompt");
      mockPromptApp.createPrompt.rejects(new Error("Test error"));

      // Find and execute the addPrompt command
      const addPromptCall = vscodeStubs.commands
        .getCalls()
        .find((call) => call.args[0] === "promptManager.addPrompt");

      await addPromptCall!.args[1]();

      expect(
        vscodeStubs.window.showErrorMessage.calledWith(
          "Failed to add prompt: Error: Test error"
        )
      ).to.be.true;
    });

    test("should handle errors in openPrompt gracefully", async () => {
      commandHandler.registerCommands();

      const testFilePath = "/test/prompt.md";
      sinon.restore(); // Restore to avoid conflicts
      sinon
        .stub(vscode.workspace, "openTextDocument")
        .rejects(new Error("File not found"));

      // Find and execute the openPrompt command
      const openPromptCall = vscodeStubs.commands
        .getCalls()
        .find((call) => call.args[0] === "promptManager.openPrompt");

      await openPromptCall!.args[1](testFilePath);

      expect(
        vscodeStubs.window.showErrorMessage.calledWith(
          "Failed to open prompt: Error: File not found"
        )
      ).to.be.true;
    });
  });
});
