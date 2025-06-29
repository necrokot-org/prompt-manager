import * as vscode from "vscode";
import { injectable, inject } from "tsyringe";
import { PromptController } from "@features/prompt-manager/domain/promptController";
import { PromptTreeItem } from "@features/prompt-manager/ui/tree/PromptTreeProvider";
import {
  FileTreeItem,
  FolderTreeItem,
  TagTreeItem,
} from "@features/prompt-manager/ui/tree/items";
import { eventBus } from "@infra/vscode/ExtensionBus";
import { DI_TOKENS } from "@infra/di/di-tokens";
import { TagService } from "@features/prompt-manager/application/services/TagService";
import { Tag } from "@features/prompt-manager/domain/Tag";

@injectable()
export class CommandHandler {
  constructor(
    @inject(DI_TOKENS.PromptController)
    private promptController: PromptController,
    @inject(DI_TOKENS.ExtensionContext)
    private context: vscode.ExtensionContext,
    @inject(DI_TOKENS.TagService)
    private tagService: TagService
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
      vscode.commands.registerCommand(
        "promptManager.copyPromptWithMeta",
        (item: PromptTreeItem) => this.copyPromptWithMeta(item)
      ),
      vscode.commands.registerCommand(
        "promptManager.deleteFolder",
        (item: PromptTreeItem) => this.deleteFolder(item)
      ),
      vscode.commands.registerCommand(
        "promptManager.askAiWithPrompt",
        (item: PromptTreeItem) => this.askAiWithPrompt(item)
      ),
      // Tag commands
      vscode.commands.registerCommand(
        "promptManager.selectTag",
        (tagValue: string) => this.selectTag(tagValue)
      ),
      vscode.commands.registerCommand("promptManager.clearTagFilter", () =>
        this.clearTagFilter()
      ),
      vscode.commands.registerCommand(
        "promptManager.renameTag",
        (item: PromptTreeItem) => this.renameTag(item)
      ),
      vscode.commands.registerCommand(
        "promptManager.deleteTag",
        (item: PromptTreeItem) => this.deleteTag(item)
      ),
    ];

    // Add all commands to subscriptions for proper cleanup
    commands.forEach((command) => this.context.subscriptions.push(command));
  }

  private async refreshTree(): Promise<void> {
    try {
      // Emit tree refresh event
      eventBus.emit("ui.tree.refresh.requested", {
        reason: "manual",
      });

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

      // Emit prompt opened event
      this.emitPromptOpened(filePath);
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
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to delete prompt: ${error}`);
    }
  }

  private async deleteFolder(item?: PromptTreeItem): Promise<void> {
    try {
      if (!item || !(item instanceof FolderTreeItem)) {
        vscode.window.showErrorMessage("No folder selected for deletion");
        return;
      }

      const folderPath = item.promptFolder.path;
      await this.promptController.deleteFolderWithContents(folderPath);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to delete folder: ${error}`);
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
        await vscode.env.openExternal(uri);
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
          `Copied content from "${item.promptFile.title}" (without meta)`
        );
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to copy prompt content: ${error}`);
    }
  }

  private async copyPromptWithMeta(item?: PromptTreeItem): Promise<void> {
    try {
      if (!item || !(item instanceof FileTreeItem)) {
        vscode.window.showErrorMessage("No prompt selected for copying");
        return;
      }

      const success = await this.promptController.copyPromptWithMetaToClipboard(
        item.promptFile.path
      );
      if (success) {
        vscode.window.showInformationMessage(
          `Copied content from "${item.promptFile.title}" (with meta)`
        );
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to copy prompt with meta: ${error}`
      );
    }
  }

  private async askAiWithPrompt(item?: PromptTreeItem): Promise<void> {
    try {
      if (!item || !(item instanceof FileTreeItem)) {
        vscode.window.showErrorMessage("No prompt selected to ask AI");
        return;
      }

      const prompt = await this.promptController.getPrompt(
        item.promptFile.path
      );

      if (!prompt) {
        return;
      }

      await vscode.commands.executeCommand("workbench.action.chat.open", {
        query: prompt,
        isPartialQuery: true,
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to ask AI: ${error}`);
    }
  }

  private emitPromptOpened(filePath: string): void {
    eventBus.emit("ui.prompt.opened", {
      filePath,
      fileName: filePath.split(/[\\/]/).pop() || filePath,
    });
  }

  // Tag command handlers

  private async selectTag(tagValue: string): Promise<void> {
    try {
      const tag = Tag.from(tagValue);
      await this.tagService.selectTag(tag);
      vscode.window.showInformationMessage(`Filtering by tag: ${tagValue}`);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to select tag: ${error}`);
    }
  }

  private async clearTagFilter(): Promise<void> {
    try {
      await this.tagService.clearTagSelection();
      vscode.window.showInformationMessage("Tag filter cleared");
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to clear tag filter: ${error}`);
    }
  }

  private async renameTag(item?: PromptTreeItem): Promise<void> {
    try {
      if (!item || !(item instanceof TagTreeItem)) {
        vscode.window.showErrorMessage("No tag selected for renaming");
        return;
      }

      const oldTagValue = item.tag.value;
      const newTagValue = await vscode.window.showInputBox({
        prompt: "Enter new tag name",
        value: oldTagValue,
        validateInput: (value) => {
          if (!value || !value.trim()) {
            return "Tag name cannot be empty";
          }
          if (value.length > 50) {
            return "Tag name is too long (max 50 characters)";
          }
          return null;
        },
      });

      if (!newTagValue || newTagValue === oldTagValue) {
        return;
      }

      await this.tagService.renameTag(item.tag, newTagValue);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to rename tag: ${error}`);
    }
  }

  private async deleteTag(item?: PromptTreeItem): Promise<void> {
    try {
      if (!item || !(item instanceof TagTreeItem)) {
        vscode.window.showErrorMessage("No tag selected for deletion");
        return;
      }

      await this.tagService.deleteTag(item.tag);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to delete tag: ${error}`);
    }
  }
}
