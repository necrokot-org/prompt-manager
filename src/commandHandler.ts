import * as vscode from "vscode";
import { injectable, inject } from "tsyringe";
import { PromptController } from "./promptController";
import {
  PromptTreeItem,
  FileTreeItem,
  FolderTreeItem,
} from "./promptTreeProvider";
import { EXTENSION_CONSTANTS } from "./config";
import { publish } from "./core/ExtensionBus";
import { Events } from "./core/EventSystem";
import { DI_TOKENS } from "./core/di-tokens";

@injectable()
export class CommandHandler {
  constructor(
    @inject(DI_TOKENS.PromptController)
    private promptController: PromptController,
    @inject(DI_TOKENS.ExtensionContext) private context: vscode.ExtensionContext
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
      // Publish tree refresh event instead of directly calling controller
      publish(Events.treeRefreshRequested("manual", "CommandHandler"));

      vscode.window.showInformationMessage("Prompt Manager tree refreshed");
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to refresh tree: ${error}`);
    }
  }

  private async addPrompt(): Promise<void> {
    try {
      await this.promptController.createNewPrompt();
      // Event will be published by PromptController when prompt is created
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

      // Publish prompt opened event
      this.publishPromptOpened(filePath);
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

      const filePath = item.promptFile.path;
      await this.promptController.deletePromptFile(filePath);

      // Publish file deleted event
      publish(Events.fileDeleted(filePath, "CommandHandler"));
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to delete prompt: ${error}`);
    }
  }

  private async createFolder(item?: PromptTreeItem): Promise<void> {
    try {
      const folderPath =
        item instanceof FolderTreeItem ? item.promptFolder.path : undefined;
      await this.promptController.createFolderInLocation(folderPath);
      // Event will be published by PromptController when folder is created
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
      // Event will be published by PromptController when prompt is created
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

  private publishPromptOpened(filePath: string): void {
    publish(Events.promptOpened(filePath, "CommandHandler"));
  }
}
