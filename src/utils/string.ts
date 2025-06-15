/**
 * String utility functions for the Prompt Manager extension
 */

export type FileNamingPattern = "snake_case" | "kebab-case" | "original";

/**
 * Normalize a filename according to the specified naming pattern
 * @param fileName - The original filename to normalize
 * @param namingPattern - The naming pattern to apply
 * @returns The normalized filename
 */
export function normalizeFileName(
  fileName: string,
  namingPattern: FileNamingPattern = "kebab-case"
): string {
  switch (namingPattern) {
    case "snake_case":
      return fileName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
    case "original":
      return fileName;
    case "kebab-case":
    default:
      // Default to kebab-case for invalid patterns
      return fileName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
  }
}
