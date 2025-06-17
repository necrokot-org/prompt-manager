import * as path from "path";
import fg from "fast-glob";
import { FileSystemManager } from "../core/FileSystemManager";
import { PromptParser } from "../core/PromptParser";
import { log } from "../core/log";
import { PromptFile, ScanOptions } from "./types";

/**
 * FilesystemWalker is a narrow utility responsible for converting files on
 * disk into rich PromptFile objects. It has no knowledge of folders / cache –
 * that is handled by higher-level collaborators.
 */
export class FilesystemWalker {
  private parser: PromptParser;

  constructor(private fileSystemManager: FileSystemManager) {
    this.parser = new PromptParser();
  }

  public async scanDirectory(
    dirPath: string,
    options: ScanOptions = {}
  ): Promise<PromptFile[]> {
    const {
      includeHidden = false,
      maxDepth = 10,
      fileExtensions = [".md"],
      excludePatterns = [],
    } = options;

    if (!this.fileSystemManager.fileExists(dirPath)) {
      return [];
    }

    // Build glob patterns for file extensions
    const patterns = fileExtensions.map((ext) =>
      ext.startsWith(".") ? `**/*${ext}` : `**/*.${ext}`
    );

    const ignore = ["**/README.md", ...excludePatterns];

    const entries = await fg(patterns, {
      cwd: dirPath,
      dot: includeHidden,
      deep: maxDepth,
      ignore,
      onlyFiles: true,
      absolute: false,
    });

    const promptFiles: PromptFile[] = [];

    for (const relativePath of entries) {
      const fullPath = path.join(dirPath, relativePath);
      const promptFile = await this.parsePromptFile(fullPath);
      if (promptFile) {
        promptFiles.push(promptFile);
      }
    }

    return promptFiles;
  }

  private async parsePromptFile(filePath: string): Promise<PromptFile | null> {
    try {
      const stats = await this.fileSystemManager.getFileStats(filePath);
      const content = await this.fileSystemManager.readFile(filePath);

      const fileName = path.basename(filePath, path.extname(filePath));
      const parsed = this.parser.parsePromptContent(content, fileName);

      return {
        name: fileName,
        title: parsed.title,
        path: filePath,
        description: parsed.description,
        tags: parsed.tags,
        fileSize: stats.size,
        isDirectory: false,
      };
    } catch (error) {
      log.error(
        `FilesystemWalker: Failed to parse prompt file ${filePath}`,
        error
      );
      return null;
    }
  }
}
