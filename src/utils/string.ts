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
  
  // Handle special cases first
  if (!fileName || typeof fileName !== "string") {
    return "";
  }

  // Use slugify with custom options to handle edge cases
  const result = slugify(fileName, { 
    separator,
    lowercase: true,
    decamelize: true
  });

  // Handle edge case where only special characters result in empty string
  // but slugify might return 'and' or other connective words
  if (result === "and" || result === "or") {
    return "";
  }

  return result;
}
