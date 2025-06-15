import * as vscode from "vscode";
import { PromptController } from "./promptController";
import {
  PromptTreeItem,
  FileTreeItem,
  FolderTreeItem,
} from "./promptTreeProvider";

export class CommandHandler {
  constructor(
    private promptController: PromptController,
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
      vscode.commands.registerCommand(
        "promptManager.copyPromptContent",
        (item: PromptTreeItem) => this.copyPromptContent(item)
      ),
    ];

    // Add all commands to subscriptions for proper cleanup
    commands.forEach((command) => this.context.subscriptions.push(command));
  }

  private async refreshTree(): Promise<void> {
    try {
      this.promptController.refresh();
      vscode.window.showInformationMessage("Prompt Manager tree refreshed");
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to refresh tree: ${error}`);
    }
  }

  private async addPrompt(): Promise<void> {
    try {
      await this.promptController.createNewPrompt();
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
      await this.promptController.openPromptFile(filePath);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open prompt: ${error}`);
    }
  }

  private async deletePrompt(item?: PromptTreeItem): Promise<void> {
    try {
      if (!item || !(item instanceof FileTreeItem)) {
        vscode.window.showErrorMessage("No prompt selected for deletion");
        return;
      }
      await this.promptController.deletePromptFile(item.promptFile.path);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to delete prompt: ${error}`);
    }
  }

  private async createFolder(item?: PromptTreeItem): Promise<void> {
    try {
      const folderPath =
        item instanceof FolderTreeItem ? item.promptFolder.path : undefined;
      await this.promptController.createFolderInLocation(folderPath);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to create folder: ${error}`);
    }
  }

  private async openDirectory(): Promise<void> {
    try {
      const promptPath = this.promptController
        .getRepository()
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
      if (!item || !(item instanceof FolderTreeItem)) {
        vscode.window.showErrorMessage("No folder selected");
        return;
      }
      await this.promptController.createPromptInFolder(item.promptFolder.path);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to add prompt to folder: ${error}`
      );
    }
  }

  private async copyPromptContent(item?: PromptTreeItem): Promise<void> {
    try {
      if (!item || !(item instanceof FileTreeItem)) {
        vscode.window.showErrorMessage("No prompt selected for copying");
        return;
      }

      const success = await this.promptController.copyPromptContentToClipboard(
        item.promptFile.path
      );
      if (success) {
        vscode.window.showInformationMessage(
          `Copied content from "${item.promptFile.title}"`
        );
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to copy prompt content: ${error}`);
    }
  }
}
