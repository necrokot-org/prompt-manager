import * as vscode from "vscode";
import { PromptManager } from "./promptManager";
import { PromptTreeProvider, PromptTreeItem } from "./promptTreeProvider";

export class CommandHandler {
  constructor(
    private promptManager: PromptManager,
    private treeProvider: PromptTreeProvider,
    private context: vscode.ExtensionContext
  ) {}

  public registerCommands(): void {
    const commands = [
      vscode.commands.registerCommand("promptManager.refreshTree", () =>
        this.refreshTree()
      ),
      vscode.commands.registerCommand("promptManager.addPrompt", () =>
        this.addPrompt()
      ),
      vscode.commands.registerCommand(
        "promptManager.openPrompt",
        (filePath: string) => this.openPrompt(filePath)
      ),
      vscode.commands.registerCommand(
        "promptManager.deletePrompt",
        (item: PromptTreeItem) => this.deletePrompt(item)
      ),
      vscode.commands.registerCommand(
        "promptManager.createFolder",
        (item: PromptTreeItem) => this.createFolder(item)
      ),
      vscode.commands.registerCommand("promptManager.openDirectory", () =>
        this.openDirectory()
      ),
      vscode.commands.registerCommand(
        "promptManager.addPromptToFolder",
        (item: PromptTreeItem) => this.addPromptToFolder(item)
      ),
    ];

    // Add all commands to subscriptions for proper cleanup
    commands.forEach((command) => this.context.subscriptions.push(command));
  }

  private async refreshTree(): Promise<void> {
    try {
      this.promptManager.refresh();
      vscode.window.showInformationMessage("Prompt Manager tree refreshed");
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to refresh tree: ${error}`);
    }
  }

  private async addPrompt(): Promise<void> {
    try {
      await this.promptManager.createNewPrompt();
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to add prompt: ${error}`);
    }
  }

  private async openPrompt(filePath?: string): Promise<void> {
    try {
      if (!filePath) {
        vscode.window.showErrorMessage("No file path provided to open prompt");
        return;
      }
      await this.promptManager.openPromptFile(filePath);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open prompt: ${error}`);
    }
  }

  private async deletePrompt(item?: PromptTreeItem): Promise<void> {
    try {
      if (!item?.promptFile) {
        vscode.window.showErrorMessage("No prompt selected for deletion");
        return;
      }
      await this.promptManager.deletePromptFile(item.promptFile.path);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to delete prompt: ${error}`);
    }
  }

  private async createFolder(item?: PromptTreeItem): Promise<void> {
    try {
      const folderPath = item?.promptFolder?.path;
      await this.promptManager.createFolderInLocation(folderPath);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to create folder: ${error}`);
    }
  }

  private async openDirectory(): Promise<void> {
    try {
      const promptPath = this.promptManager
        .getFileManager()
        .getPromptManagerPath();
      if (promptPath) {
        const uri = vscode.Uri.file(promptPath);
        await vscode.commands.executeCommand("vscode.openFolder", uri, {
          forceNewWindow: false,
        });
      } else {
        vscode.window.showErrorMessage("No prompt directory found");
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open directory: ${error}`);
    }
  }

  private async addPromptToFolder(item?: PromptTreeItem): Promise<void> {
    try {
      if (!item?.promptFolder) {
        vscode.window.showErrorMessage("No folder selected");
        return;
      }
      await this.promptManager.createPromptInFolder(item.promptFolder.path);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to add prompt to folder: ${error}`
      );
    }
  }
}
