import * as vscode from "vscode";
import { PromptApp } from "../../application/PromptApp";
import { TagApp } from "../../application/TagApp";
import { SearchApp } from "../../application/SearchApp";
import { IndexApp } from "../../application/IndexApp";
import { Tag } from "../../domain/model/Tag";

export class CommandHandler {
  constructor(
    private promptApp: PromptApp,
    private tagApp: TagApp,
    private searchApp: SearchApp,
    private indexApp: IndexApp
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
        (filePath: string | vscode.Uri) => this.openPrompt(filePath)
      ),
      vscode.commands.registerCommand(
        "promptManager.deletePrompt",
        (filePath: string | vscode.Uri) => this.deletePrompt(filePath)
      ),
      vscode.commands.registerCommand(
        "promptManager.createFolder",
        (folderPath?: string) => this.createFolder(folderPath)
      ),
      vscode.commands.registerCommand("promptManager.openDirectory", () =>
        this.openDirectory()
      ),
      vscode.commands.registerCommand(
        "promptManager.addPromptToFolder",
        (folderPath: string | vscode.Uri) => this.addPromptToFolder(folderPath)
      ),
      vscode.commands.registerCommand(
        "promptManager.copyPromptContent",
        (file: string | vscode.Uri | any) => this.copyPromptContent(file)
      ),
      vscode.commands.registerCommand(
        "promptManager.copyPromptWithMeta",
        (file: string | vscode.Uri | any) => this.copyPromptWithMeta(file)
      ),
      vscode.commands.registerCommand(
        "promptManager.deleteFolder",
        (folderPath: string | vscode.Uri) => this.deleteFolder(folderPath)
      ),
      // Tag commands
      vscode.commands.registerCommand("promptManager.selectTag", (tag: Tag) =>
        this.selectTag(tag)
      ),
      vscode.commands.registerCommand("promptManager.clearTagFilter", () =>
        this.clearTagFilter()
      ),
    ];

    // Commands will be managed by the extension context
  }

  private toPath(input: unknown): string {
    if (!input) {
      throw new Error("No target provided");
    }
    if (typeof input === "string") {
      return input;
    }
    const maybeUri = input as vscode.Uri;
    if (maybeUri && typeof maybeUri.fsPath === "string") {
      return maybeUri.fsPath;
    }
    const anyInput = input as any;
    if (anyInput?.resourceUri?.fsPath) {
      return anyInput.resourceUri.fsPath;
    }
    if (anyInput?.promptFile?.path) {
      return anyInput.promptFile.path;
    }
    if (anyInput?.path && typeof anyInput.path === "string") {
      return anyInput.path;
    }
    throw new Error("Unsupported argument type");
  }

  private async refreshTree(): Promise<void> {
    try {
      await this.indexApp.rebuildNow();
      vscode.window.showInformationMessage("Prompt Manager tree refreshed");
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to refresh tree: ${error}`);
    }
  }

  private async addPrompt(): Promise<void> {
    try {
      const name = await vscode.window.showInputBox({
        prompt: "Enter prompt name",
        placeHolder: "My Prompt",
      });

      if (!name) {
        return;
      }

      await this.promptApp.createPrompt(name);
      vscode.window.showInformationMessage(`Created prompt: ${name}`);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to add prompt: ${error}`);
    }
  }

  private async openPrompt(filePath: string | vscode.Uri): Promise<void> {
    try {
      const path = typeof filePath === "string" ? filePath : filePath.fsPath;
      const document = await vscode.workspace.openTextDocument(path);
      await vscode.window.showTextDocument(document);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open prompt: ${error}`);
    }
  }

  private async deletePrompt(filePath: string | vscode.Uri): Promise<void> {
    try {
      const path = typeof filePath === "string" ? filePath : filePath.fsPath;
      const confirm = await vscode.window.showWarningMessage(
        "Are you sure you want to delete this prompt?",
        { modal: true },
        "Delete"
      );

      if (confirm === "Delete") {
        await this.promptApp.deletePrompt(path);
        vscode.window.showInformationMessage("Prompt deleted");
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to delete prompt: ${error}`);
    }
  }

  private async createFolder(folderPath?: string): Promise<void> {
    try {
      const name = await vscode.window.showInputBox({
        prompt: "Enter folder name",
        placeHolder: "My Folder",
      });

      if (!name) {
        return;
      }

      await this.promptApp.createFolder(name, folderPath);
      vscode.window.showInformationMessage(`Created folder: ${name}`);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to create folder: ${error}`);
    }
  }

  private async openDirectory(): Promise<void> {
    try {
      const rootPath = await this.promptApp["store"].rootPath();
      if (rootPath) {
        const uri = vscode.Uri.file(rootPath);
        await vscode.env.openExternal(uri);
      } else {
        vscode.window.showErrorMessage("No prompt directory found");
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open directory: ${error}`);
    }
  }

  private async addPromptToFolder(
    folderPath: string | vscode.Uri
  ): Promise<void> {
    try {
      const path =
        typeof folderPath === "string" ? folderPath : folderPath.fsPath;
      const name = await vscode.window.showInputBox({
        prompt: "Enter prompt name",
        placeHolder: "My Prompt",
      });

      if (!name) {
        return;
      }

      await this.promptApp.createPrompt(name, path);
      vscode.window.showInformationMessage(`Created prompt in folder: ${name}`);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to add prompt to folder: ${error}`
      );
    }
  }

  private async copyPromptContent(
    file: string | vscode.Uri | any
  ): Promise<void> {
    try {
      const path = this.toPath(file);
      const content = await this.promptApp.copyContent(path, false);
      await vscode.env.clipboard.writeText(content);
      vscode.window.showInformationMessage(
        "Prompt content copied to clipboard"
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to copy prompt content: ${error}`);
    }
  }

  private async copyPromptWithMeta(
    file: string | vscode.Uri | any
  ): Promise<void> {
    try {
      const path = this.toPath(file);
      const content = await this.promptApp.copyContent(path, true);
      await vscode.env.clipboard.writeText(content);
      vscode.window.showInformationMessage(
        "Prompt with metadata copied to clipboard"
      );
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to copy prompt with meta: ${error}`
      );
    }
  }

  private async deleteFolder(folderPath: string | vscode.Uri): Promise<void> {
    try {
      const path =
        typeof folderPath === "string" ? folderPath : folderPath.fsPath;
      const confirm = await vscode.window.showWarningMessage(
        "Are you sure you want to delete this folder and all its contents?",
        { modal: true },
        "Delete"
      );

      if (confirm === "Delete") {
        await this.promptApp.deleteFolder(path);
        vscode.window.showInformationMessage("Folder deleted");
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to delete folder: ${error}`);
    }
  }

  private async selectTag(tag: Tag): Promise<void> {
    try {
      const current = this.tagApp.getActiveTag();
      if (current?.equals(tag)) {
        this.tagApp.clear();
        vscode.window.showInformationMessage("Tag filter cleared");
      } else {
        this.tagApp.select(tag);
        vscode.window.showInformationMessage(`Filtering by tag: ${tag.value}`);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to select tag: ${error}`);
    }
  }

  private async clearTagFilter(): Promise<void> {
    try {
      this.tagApp.clear();
      vscode.window.showInformationMessage("Tag filter cleared");
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to clear tag filter: ${error}`);
    }
  }
}
