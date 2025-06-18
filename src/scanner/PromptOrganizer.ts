import * as path from "path";
import { FileSystemManager } from "@infra/fs/FileSystemManager";
import { log } from "@infra/vscode/log";
import { PromptFile, PromptFolder, PromptStructure } from "./types";

/**
 * PromptOrganizer groups PromptFile objects into a hierarchical PromptStructure
 * (folders & root prompts). It contains *no* filesystem traversal logic – that
 * lives in FilesystemWalker.
 */
export class PromptOrganizer {
  constructor(private fileSystemManager: FileSystemManager) {}

  public async organize(
    promptFiles: PromptFile[],
    dirPath: string
  ): Promise<PromptStructure> {
    const folders: PromptFolder[] = [];
    const rootPrompts: PromptFile[] = [];
    const folderMap = new Map<string, PromptFile[]>();

    for (const file of promptFiles) {
      const relativePath = path.relative(dirPath, file.path);
      const dirName = path.dirname(relativePath);

      if (dirName === "." || dirName === "") {
        rootPrompts.push(file);
      } else {
        // Simple fix: don't flatten - use the full directory path
        if (!folderMap.has(dirName)) {
          folderMap.set(dirName, []);
        }
        folderMap.get(dirName)!.push(file);
      }
    }

    // Include empty directories to preserve structure in UI
    try {
      await this.addEmptyDirectories(dirPath, folderMap, "");
    } catch (err) {
      log.warn("PromptOrganizer: Failed to read dir entries", err);
    }

    // Convert folderMap to folder array
    for (const [folderPath, prompts] of folderMap) {
      const folderName = path.basename(folderPath);
      const fullPath = path.join(dirPath, folderPath);

      folders.push({
        name: folderName,
        path: fullPath,
        prompts: prompts.sort((a, b) => a.title.localeCompare(b.title)),
      });
    }

    // Sort folders by name for consistent ordering
    folders.sort((a, b) => a.name.localeCompare(b.name));
    rootPrompts.sort((a, b) => a.title.localeCompare(b.title));

    return { folders, rootPrompts };
  }

  /**
   * Recursively scan for empty directories and add them to the folder map
   */
  private async addEmptyDirectories(
    basePath: string,
    folderMap: Map<string, PromptFile[]>,
    currentRelativePath: string
  ): Promise<void> {
    const currentPath = path.join(basePath, currentRelativePath);

    try {
      const dirEntries = await this.fileSystemManager.readDirectory(
        currentPath
      );

      for (const entry of dirEntries) {
        if (entry.isDirectory()) {
          const relativeFolderPath = currentRelativePath
            ? path.join(currentRelativePath, entry.name)
            : entry.name;

          // Add empty directory if not already in map
          if (!folderMap.has(relativeFolderPath)) {
            folderMap.set(relativeFolderPath, []);
          }

          // Recursively scan subdirectories
          await this.addEmptyDirectories(
            basePath,
            folderMap,
            relativeFolderPath
          );
        }
      }
    } catch (err) {
      log.warn(`PromptOrganizer: Failed to read directory ${currentPath}`, err);
    }
  }
}
