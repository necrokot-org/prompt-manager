/**
 * String utility functions for the Prompt Manager extension
 */
import slugify from "@sindresorhus/slugify";

export type FileNamingPattern = "snake_case" | "kebab-case" | "original";

/**
 * Normalize a filename according to the specified naming pattern using @sindresorhus/slugify
 * @param fileName - The original filename to normalize
 * @param namingPattern - The naming pattern to apply
 * @returns The normalized filename
 */
export function normalizeFileName(
  fileName: string,
  namingPattern: FileNamingPattern = "kebab-case"
): string {
  if (namingPattern === "original") {
    return fileName;
  }

  const separator = namingPattern === "snake_case" ? "_" : "-";
  return slugify(fileName, { separator });
}
