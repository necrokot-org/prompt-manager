import * as path from "path";
import { injectable, inject } from "tsyringe";
import { PromptStore } from "../../application/ports/PromptStore";
import { FileSystemManager } from "../fs/FileSystemManager";
import { log } from "../vscode/log";
import { sanitizeFileName } from "../../validation/index";
import {
  serializePromptContent,
  PromptContent,
} from "../../validation/schemas/prompt";
import { DI_TOKENS } from "../di/di-tokens";

/**
 * File system implementation of PromptStore
 * Handles all file system operations for prompts and folders
 */
@injectable()
export class FsPromptStore implements PromptStore {
  constructor(
    @inject(DI_TOKENS.FileSystemManager)
    private readonly fs: FileSystemManager
  ) {}

  async rootPath(): Promise<string | undefined> {
    return this.fs.getPromptManagerPath();
  }

  async createPrompt(name: string, folderPath?: string): Promise<string> {
    const rootPath = await this.rootPath();
    if (!rootPath) {
      throw new Error("Prompt manager path not available");
    }

    await this.ensureDirectory();

    // Sanitize filename while preserving spaces and original formatting
    const sanitizedName = sanitizeFileName(name, {
      namingPattern: "original",
    });
    const fullFileName = `${sanitizedName}.md`;

    const targetDir = folderPath || rootPath;
    const filePath = path.join(targetDir, fullFileName);

    // Check if file already exists
    if (await this.exists(filePath)) {
      throw new Error(`Prompt file "${fullFileName}" already exists`);
    }

    // Build prompt content
    const promptContent: PromptContent = {
      content: `Write your prompt here...`,
      title: name,
      description: "",
      tags: [],
    };
    const frontMatterContent = serializePromptContent(promptContent);

    await this.fs.writeFile(filePath, frontMatterContent);

    return filePath;
  }

  async deletePrompt(path: string): Promise<void> {
    await this.fs.deleteFile(path);
  }

  async createFolder(name: string, parentFolderPath?: string): Promise<string> {
    const rootPath = await this.rootPath();
    if (!rootPath) {
      throw new Error("Prompt manager path not available");
    }

    await this.ensureDirectory();

    const sanitizedName = sanitizeFileName(name);
    const targetDir = parentFolderPath || rootPath;
    const folderPath = path.join(targetDir, sanitizedName);

    if (await this.exists(folderPath)) {
      throw new Error(`Folder "${sanitizedName}" already exists`);
    }

    await this.fs.createDirectory(folderPath);

    return folderPath;
  }

  async deleteFolder(path: string): Promise<void> {
    await this.fs.deleteFile(path); // Note: deleteFile also works for directories
  }

  async read(path: string): Promise<string> {
    return await this.fs.readFile(path);
  }

  async write(path: string, content: string): Promise<void> {
    await this.fs.writeFile(path, content);
  }

  async moveFile(sourcePath: string, targetPath: string): Promise<void> {
    await this.fs.moveFile(sourcePath, targetPath);
  }

  async moveFolder(sourcePath: string, targetPath: string): Promise<void> {
    await this.fs.moveFile(sourcePath, targetPath); // Note: moveFile works for both
  }

  async exists(path: string): Promise<boolean> {
    return this.fs.fileExists(path);
  }

  private async ensureDirectory(): Promise<void> {
    const success = await this.fs.ensurePromptManagerDirectory();
    if (!success) {
      throw new Error("Failed to ensure prompt manager directory exists");
    }
  }
}
