import { PromptFile } from "core/DirectoryScanner";
import { SearchResult } from "@features/search/core/SearchEngine";
import { FileSystemManager } from "@infra/fs/FileSystemManager";
import { log } from "@infra/vscode/log";

/**
 * Convert a SearchResult to a PromptFile using provided dependencies
 * This utility eliminates duplication between FileManager and SearchService
 */
export async function searchResultToPromptFile(
  result: SearchResult,
  allFiles: PromptFile[],
  fileSystemManager: FileSystemManager
): Promise<PromptFile> {
  // Try to find the file in the provided files list
  const file = allFiles.find((f) => f.path === result.filePath);

  if (file) {
    return file;
  }

  // Fallback: create a PromptFile from the search result
  try {
    const stats = await fileSystemManager.getFileStats(result.filePath);
    return {
      name: result.fileName,
      title: result.title,
      path: result.filePath,
      description: undefined,
      tags: [],
      fileSize: stats.size,
      isDirectory: false,
    };
  } catch (error) {
    log.error(`Failed to get file stats for ${result.filePath}:`, error);
    // Return minimal file info
    return {
      name: result.fileName,
      title: result.title,
      path: result.filePath,
      description: undefined,
      tags: [],
      fileSize: 0,
      isDirectory: false,
    };
  }
}
