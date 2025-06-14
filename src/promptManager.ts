import * as vscode from "vscode";
import { FileManager, PromptStructure, PromptFile } from "./fileManager";

export class PromptManager {
  private fileManager: FileManager;
  private _onDidChangeTreeData: vscode.EventEmitter<void> =
    new vscode.EventEmitter<void>();
  public readonly onDidChangeTreeData: vscode.Event<void> =
    this._onDidChangeTreeData.event;

  constructor() {
    this.fileManager = new FileManager();
    this.setupFileWatcher();
  }

  private setupFileWatcher(): void {
    const promptPath = this.fileManager.getPromptManagerPath();
    if (promptPath) {
      const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(promptPath, "**/*.md")
      );

      watcher.onDidCreate(() => this.refresh());
      watcher.onDidDelete(() => this.refresh());
      watcher.onDidChange((uri) => {
        this.handleFileChange(uri);
        this.refresh();
      });
    }
  }

  private async handleFileChange(uri: vscode.Uri): Promise<void> {
    const config = vscode.workspace.getConfiguration("promptManager");
    const autoTimestamps = config.get<boolean>("autoTimestamps", true);

    if (autoTimestamps) {
      await this.updateFileTimestamp(uri.fsPath);
    }
  }

  private async updateFileTimestamp(filePath: string): Promise<void> {
    try {
      const fs = require("fs").promises;
      const content = await fs.readFile(filePath, "utf8");

      // Check if file has frontmatter
      const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (frontMatterMatch) {
        const now = new Date().toISOString();
        const updatedContent = content.replace(
          /^(---\n[\s\S]*?modified:\s*")([^"]*?)("\n[\s\S]*?---)/,
          `$1${now}$3`
        );

        if (updatedContent !== content) {
          await fs.writeFile(filePath, updatedContent, "utf8");
        }
      }
    } catch (error) {
      console.error("Failed to update timestamp:", error);
    }
  }

  public async initialize(): Promise<boolean> {
    const success = await this.fileManager.ensurePromptManagerDirectory();
    if (success) {
      this.refresh();
      // Set context variable to show the tree view
      vscode.commands.executeCommand(
        "setContext",
        "workspaceHasPromptManager",
        true
      );
    }
    return success;
  }

  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  public async getPromptStructure(): Promise<PromptStructure> {
    return await this.fileManager.scanPrompts();
  }

  public async createNewPrompt(): Promise<void> {
    const fileName = await vscode.window.showInputBox({
      prompt: "Enter the name for your new prompt",
      placeHolder: "e.g., Code Review Helper",
      validateInput: (value: string) => {
        if (!value || value.trim().length === 0) {
          return "Prompt name cannot be empty";
        }
        if (value.length > 50) {
          return "Prompt name must be 50 characters or less";
        }
        return undefined;
      },
    });

    if (!fileName) {
      return;
    }

    // Ask user if they want to create in a folder
    const folderChoice = await vscode.window.showQuickPick(
      [
        {
          label: "Root directory",
          description: "Create in .prompt_manager root",
        },
        { label: "Select folder", description: "Choose an existing folder" },
        { label: "Create new folder", description: "Create in a new folder" },
      ],
      {
        placeHolder: "Where would you like to create this prompt?",
      }
    );

    if (!folderChoice) {
      return;
    }

    let targetFolderPath: string | undefined;

    if (folderChoice.label === "Select folder") {
      targetFolderPath = await this.selectExistingFolder();
    } else if (folderChoice.label === "Create new folder") {
      targetFolderPath = await this.createNewFolder();
    }

    const filePath = await this.fileManager.createPromptFile(
      fileName.trim(),
      targetFolderPath
    );
    if (filePath) {
      await this.openPromptFile(filePath);
      this.refresh();
    }
  }

  private async selectExistingFolder(): Promise<string | undefined> {
    const promptStructure = await this.fileManager.scanPrompts();
    if (promptStructure.folders.length === 0) {
      vscode.window.showInformationMessage(
        "No folders found. Creating in root directory."
      );
      return undefined;
    }

    const folderItems = promptStructure.folders.map((folder) => ({
      label: folder.name,
      description: `${folder.prompts.length} prompts`,
      detail: folder.path,
    }));

    const selectedFolder = await vscode.window.showQuickPick(folderItems, {
      placeHolder: "Select a folder",
    });

    return selectedFolder?.detail;
  }

  private async createNewFolder(): Promise<string | undefined> {
    const folderName = await vscode.window.showInputBox({
      prompt: "Enter the name for the new folder",
      placeHolder: "e.g., coding, writing, templates",
      validateInput: (value: string) => {
        if (!value || value.trim().length === 0) {
          return "Folder name cannot be empty";
        }
        if (value.length > 30) {
          return "Folder name must be 30 characters or less";
        }
        return undefined;
      },
    });

    if (!folderName) {
      return undefined;
    }

    const result = await this.fileManager.createFolder(folderName.trim());
    return result ?? undefined;
  }

  public async openPromptFile(filePath: string): Promise<void> {
    try {
      const document = await vscode.workspace.openTextDocument(filePath);
      await vscode.window.showTextDocument(document);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open prompt file: ${error}`);
    }
  }

  public async deletePromptFile(filePath: string): Promise<void> {
    const fileName = filePath.split(/[\\/]/).pop();
    const confirmation = await vscode.window.showWarningMessage(
      `Are you sure you want to delete "${fileName}"?`,
      { modal: true },
      "Delete"
    );

    if (confirmation === "Delete") {
      const success = await this.fileManager.deletePromptFile(filePath);
      if (success) {
        this.refresh();
        vscode.window.showInformationMessage(`Deleted "${fileName}"`);
      }
    }
  }

  public async createFolderInLocation(folderPath?: string): Promise<void> {
    const folderName = await vscode.window.showInputBox({
      prompt: "Enter the name for the new folder",
      placeHolder: "e.g., coding, writing, templates",
      validateInput: (value: string) => {
        if (!value || value.trim().length === 0) {
          return "Folder name cannot be empty";
        }
        if (value.length > 30) {
          return "Folder name must be 30 characters or less";
        }
        return undefined;
      },
    });

    if (!folderName) {
      return;
    }

    const newFolderPath = await this.fileManager.createFolder(
      folderName.trim()
    );
    if (newFolderPath) {
      this.refresh();
      vscode.window.showInformationMessage(`Created folder "${folderName}"`);
    }
  }

  public validatePromptContent(content: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!content || content.trim().length === 0) {
      errors.push("Prompt content cannot be empty");
    }

    if (content.length > 50000) {
      errors.push("Prompt content is too large (max 50KB)");
    }

    // Validate front matter if present
    const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontMatterMatch) {
      const frontMatter = frontMatterMatch[1];
      if (!frontMatter.includes("title:")) {
        errors.push("Front matter must include a title field");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  public getFileManager(): FileManager {
    return this.fileManager;
  }

  public async createPromptInFolder(folderPath: string): Promise<void> {
    const fileName = await vscode.window.showInputBox({
      prompt: "Enter the name for your new prompt",
      placeHolder: "e.g., Code Review Helper",
      validateInput: (value: string) => {
        if (!value || value.trim().length === 0) {
          return "Prompt name cannot be empty";
        }
        if (value.length > 50) {
          return "Prompt name must be 50 characters or less";
        }
        return undefined;
      },
    });

    if (!fileName) {
      return;
    }

    const filePath = await this.fileManager.createPromptFile(
      fileName.trim(),
      folderPath
    );
    if (filePath) {
      await this.openPromptFile(filePath);
      this.refresh();
    }
  }
}
