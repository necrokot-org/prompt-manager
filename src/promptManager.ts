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

      watcher.onDidCreate(() => {
        console.log("PromptManager: File created, invalidating index");
        this.fileManager.invalidateIndex();
        this.refresh();
      });

      watcher.onDidDelete(() => {
        console.log("PromptManager: File deleted, invalidating index");
        this.fileManager.invalidateIndex();
        this.refresh();
      });

      watcher.onDidChange((uri) => {
        console.log("PromptManager: File changed, invalidating index");
        this.handleFileChange(uri);
        this.fileManager.invalidateIndex();
        this.refresh();
      });
    }
  }

  private async handleFileChange(uri: vscode.Uri): Promise<void> {
    // File change handling without timestamp updates
    // This method can be used for other file change reactions in the future
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

    if (content.length > 500000) {
      errors.push("Prompt content is too large (max 500KB)");
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

  public async copyPromptContentToClipboard(
    filePath: string
  ): Promise<boolean> {
    try {
      const content = await this.readFileContent(filePath);
      if (!content) {
        vscode.window.showErrorMessage("Failed to read prompt file");
        return false;
      }

      const contentWithoutFrontMatter = this.stripFrontMatter(content);
      await vscode.env.clipboard.writeText(contentWithoutFrontMatter);
      return true;
    } catch (error) {
      console.error(`Failed to copy content to clipboard: ${error}`);
      vscode.window.showErrorMessage(`Failed to copy content: ${error}`);
      return false;
    }
  }

  private async readFileContent(filePath: string): Promise<string | null> {
    try {
      const fs = await import("fs");
      return await fs.promises.readFile(filePath, "utf8");
    } catch (error) {
      console.error(`Failed to read file ${filePath}:`, error);
      return null;
    }
  }

  private stripFrontMatter(content: string): string {
    // Check if content starts with front matter (---)
    const frontMatterMatch = content.match(
      /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/
    );

    if (frontMatterMatch) {
      // Return content after front matter, trimming leading/trailing whitespace
      return frontMatterMatch[2].trim();
    }

    // If no front matter found, return original content
    return content.trim();
  }
}
