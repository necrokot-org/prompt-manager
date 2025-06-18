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
        const topLevelDir = dirName.split(path.sep)[0];
        if (!folderMap.has(topLevelDir)) {
          folderMap.set(topLevelDir, []);
        }
        folderMap.get(topLevelDir)!.push(file);
      }
    }

    // Include empty directories to preserve structure in UI
    try {
      const dirEntries = await this.fileSystemManager.readDirectory(dirPath);
      for (const entry of dirEntries) {
        if (entry.isDirectory() && !folderMap.has(entry.name)) {
          folders.push({
            name: entry.name,
            path: path.join(dirPath, entry.name),
            prompts: [],
          });
        }
      }
    } catch (err) {
      log.warn("PromptOrganizer: Failed to read dir entries", err);
    }

    // Convert folderMap to array
    for (const [folderName, prompts] of folderMap) {
      folders.push({
        name: folderName,
        path: path.join(dirPath, folderName),
        prompts: prompts.sort((a, b) => a.title.localeCompare(b.title)),
      });
    }

    // Sort for deterministic order
    folders.sort((a, b) => a.name.localeCompare(b.name));
    rootPrompts.sort((a, b) => a.title.localeCompare(b.title));

    return { folders, rootPrompts };
  }
}
