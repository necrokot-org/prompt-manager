import {
  parsePromptContentSync,
  ParsedPromptContent,
} from "@root/validation/schemas/prompt";
import { LRUCache } from "lru-cache";
import { createHash } from "node:crypto";

export interface FileContent {
  path: string;
  content: string;
  parsed?: ParsedPromptContent;
}

// Global cache for parsed content
const parseCache = new LRUCache<string, ParsedPromptContent>({
  max: 5000,
});

/**
 * Parse file content with caching support
 */
export function getParsedContent(file: FileContent): ParsedPromptContent {
  if (file.parsed) {
    return file.parsed;
  }

  // Generate a stable hash of the content so that any modification – even if
  // the length stays the same – produces a different cache key. This avoids
  // returning stale parsed data when the file is edited without changing
  // its size.
  const contentHash = createHash("sha1").update(file.content).digest("hex");
  const cacheKey = `${file.path}-${contentHash}`;
  const cached = parseCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const fileName = getFileNameFromPath(file.path);
  const parsedContent = parsePromptContentSync(file.content, fileName);

  // Convert to legacy interface for backward compatibility
  const parsed: ParsedPromptContent = {
    frontMatter: parsedContent.frontMatter || {},
    content: parsedContent.content,
    title: parsedContent.title || fileName.replace(/-/g, " "),
    description: parsedContent.description,
    tags: parsedContent.tags || [],
  };

  parseCache.set(cacheKey, parsed);
  return parsed;
}

/**
 * Clear the parsing cache
 */
export function clearParseCache(): void {
  parseCache.clear();
}

/**
 * Extract filename from file path
 */
export function getFileNameFromPath(filePath: string): string {
  return filePath.split("/").pop() || filePath;
}
