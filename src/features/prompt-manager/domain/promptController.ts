import * as vscode from "vscode";
import { injectable, inject } from "tsyringe";
import { PromptRepository } from "./promptRepository";
import { PromptStructure } from "@features/prompt-manager/data/fileManager";
import { EXTENSION_CONSTANTS } from "@infra/config/config";
import { eventBus } from "@infra/vscode/ExtensionBus";
import { log } from "@infra/vscode/log";
import {
  validateFileName,
  sanitizeFileName,
  getErrorMessages,
} from "@root/validation/index";
import trim from "lodash-es/trim.js";
import { DI_TOKENS } from "@infra/di/di-tokens";

/**
 * PromptController handles VSCode UI orchestration and user interactions.
 * It uses PromptRepository for data operations and publishes UI events.
 * Now integrated with the centralized event system and dependency injection.
 */
@injectable()
export class PromptController {
  private repository: PromptRepository;
  private subscriptions: any[] = [];

  constructor(
    @inject(DI_TOKENS.PromptRepository) repository: PromptRepository
  ) {
    this.repository = repository;
  }

  /**
   * Initialize the controller and repository
   */
  public async initialize(): Promise<boolean> {
    const success = await this.repository.initialize();
    if (success) {
      this.refresh();
      // Set context variable to show the tree view
      vscode.commands.executeCommand(
        "setContext",
        EXTENSION_CONSTANTS.WORKSPACE_HAS_PROMPT_MANAGER,
        true
      );
    }
    return success;
  }

  /**
   * Refresh the tree view by publishing a tree refresh event
   */
  public refresh(): void {
    this.publishTreeRefreshEvent("manual");
  }

  /**
   * Publish a tree refresh event
   */
  private publishTreeRefreshEvent(
    reason: "manual" | "file-change" | "search-change"
  ): void {
    eventBus.emit("ui.tree.refresh.requested", { reason });
  }

  /**
   * Get prompt structure from repository
   */
  public async getPromptStructure(): Promise<PromptStructure> {
    return await this.repository.getPromptStructure();
  }

  /**
   * Create a new prompt with user interaction
   */
  public async createNewPrompt(): Promise<void> {
    const fileName = await this.askPromptName();
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

    await this.createAndOpenPrompt(fileName, targetFolderPath);
  }

  /**
   * Let user select an existing folder
   */
  private async selectExistingFolder(): Promise<string | undefined> {
    const promptStructure = await this.repository.getPromptStructure();
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

  /**
   * Create a new folder with user input
   */
  private async createNewFolder(): Promise<string | undefined> {
    const folderName = await this.askFolderName();
    if (!folderName) {
      return undefined;
    }

    const result = await this.repository.createFolder(folderName);
    return result ?? undefined;
  }

  /**
   * Open a prompt file in VS Code editor
   */
  public async openPromptFile(filePath: string): Promise<void> {
    try {
      const document = await vscode.workspace.openTextDocument(filePath);
      await vscode.window.showTextDocument(document);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open prompt file: ${error}`);
    }
  }

  /**
   * Delete a prompt file with confirmation
   */
  public async deletePromptFile(filePath: string): Promise<void> {
    const fileName = filePath.split(/[\\/]/).pop();
    const confirmation = await vscode.window.showWarningMessage(
      `Are you sure you want to delete "${fileName}"?`,
      { modal: true },
      "Delete"
    );

    if (confirmation === "Delete") {
      const success = await this.repository.deletePromptFile(filePath);
      if (success) {
        vscode.window.showInformationMessage(`Deleted "${fileName}"`);
      }
    }
  }

  /**
   * Delete a folder and all its contents with confirmation
   */
  public async deleteFolderWithContents(folderPath: string): Promise<void> {
    const folderName = folderPath.split(/[\\/]/).pop();
    const confirmation = await vscode.window.showWarningMessage(
      `Are you sure you want to delete folder "${folderName}" and all its contents?`,
      { modal: true },
      "Delete"
    );

    if (confirmation === "Delete") {
      const success = await this.repository.deleteFolderWithContents(
        folderPath
      );
      if (success) {
        vscode.window.showInformationMessage(`Deleted folder "${folderName}"`);
      }
    }
  }

  /**
   * Create a folder in a specific location
   */
  public async createFolderInLocation(folderPath?: string): Promise<void> {
    const folderName = await this.askFolderName();
    if (!folderName) {
      return;
    }

    const newFolderPath = await this.repository.createFolder(
      folderName,
      folderPath
    );
    if (newFolderPath) {
      vscode.window.showInformationMessage(`Created folder "${folderName}"`);
    }
  }

  /**
   * Create a prompt in a specific folder
   */
  public async createPromptInFolder(folderPath: string): Promise<void> {
    const fileName = await this.askPromptName();
    if (!fileName) {
      return;
    }

    await this.createAndOpenPrompt(fileName, folderPath);
  }

  /**
   * Copy prompt content to clipboard (without front matter)
   */
  public async copyPromptContentToClipboard(
    filePath: string
  ): Promise<boolean> {
    try {
      const content = await this.repository.readFileContent(filePath);
      if (!content) {
        vscode.window.showErrorMessage("Failed to read prompt file");
        return false;
      }

      const contentWithoutFrontMatter = this.stripFrontMatter(content);
      await vscode.env.clipboard.writeText(contentWithoutFrontMatter);
      return true;
    } catch (error) {
      log.error(`Failed to copy content to clipboard: ${error}`);
      vscode.window.showErrorMessage(`Failed to copy content: ${error}`);
      return false;
    }
  }

  /**
   * Copy prompt content to clipboard (with front matter/meta)
   */
  public async copyPromptWithMetaToClipboard(
    filePath: string
  ): Promise<boolean> {
    try {
      const content = await this.repository.readFileContent(filePath);
      if (!content) {
        vscode.window.showErrorMessage("Failed to read prompt file");
        return false;
      }

      await vscode.env.clipboard.writeText(content);
      return true;
    } catch (error) {
      log.error(`Failed to copy content with meta to clipboard: ${error}`);
      vscode.window.showErrorMessage(
        `Failed to copy content with meta: ${error}`
      );
      return false;
    }
  }

  /**
   * Strip front matter from content
   */
  private stripFrontMatter(content: string): string {
    // Check if content starts with front matter (---)
    const frontMatterMatch = content.match(
      /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/
    );

    if (frontMatterMatch) {
      // Return content after front matter, trimming leading/trailing whitespace
      return trim(frontMatterMatch[2]);
    }

    // If no front matter found, return original content
    return trim(content);
  }

  /**
   * Helper method to ask for prompt name with validation
   */
  private async askPromptName(): Promise<string | undefined> {
    const fileName = await vscode.window.showInputBox({
      prompt: "Enter the name for your new prompt",
      placeHolder: "e.g., Code Review Helper",
      validateInput: (value: string) => {
        // Validate without requiring extension - createPromptFile will handle adding .md
        const result = validateFileName(value, {
          namingPattern: "original", // Preserve user input as-is for title
        });

        if (!result.success) {
          const errors = getErrorMessages(result);
          return errors[0] || "Invalid file name";
        }

        return undefined;
      },
    });

    // Return the original input as-is - createPromptFile will handle filename normalization and .md extension
    return fileName;
  }

  /**
   * Helper method to ask for folder name with validation
   */
  private async askFolderName(): Promise<string | undefined> {
    const folderName = await vscode.window.showInputBox({
      prompt: "Enter the name for the new folder",
      placeHolder: "e.g., coding, writing, templates",
      validateInput: (value: string) => {
        const result = validateFileName(value, {
          namingPattern: "kebab-case",
        });

        if (!result.success) {
          const errors = getErrorMessages(result);
          return errors[0] || "Invalid folder name";
        }

        return undefined;
      },
    });

    if (folderName) {
      // Sanitize the folder name before returning
      return sanitizeFileName(folderName);
    }

    return undefined;
  }

  /**
   * Helper method to create prompt file, open it, and refresh the tree
   */
  private async createAndOpenPrompt(
    fileName: string,
    targetFolderPath?: string
  ): Promise<void> {
    const filePath = await this.repository.createPromptFile(
      fileName,
      targetFolderPath
    );
    if (filePath) {
      await this.openPromptFile(filePath);
    }
  }

  /**
   * Get the repository for advanced operations
   */
  public getRepository(): PromptRepository {
    return this.repository;
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this.repository.dispose();

    // Unsubscribe from all event subscriptions
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
    this.subscriptions = [];
  }

  public async getPrompt(filePath: string): Promise<string | null> {
    // Convenience helper for callers that need raw prompt file content.
    // Reads the file through the repository layer so we keep all I/O in a single place.
    const content = await this.repository.readFileContent(filePath);
    if (!content) {
      return null;
    }
    return this.stripFrontMatter(content);
  }
}
