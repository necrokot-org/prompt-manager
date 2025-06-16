/**
 * String utility functions for the Prompt Manager extension
 */
import { kebabCase, snakeCase } from "change-case";

export type FileNamingPattern = "snake_case" | "kebab-case" | "original";

/**
 * Normalize a filename according to the specified naming pattern using change-case
 * @param fileName - The original filename to normalize
 * @param namingPattern - The naming pattern to apply
 * @returns Promise that resolves to the normalized filename
 */
export async function normalizeFileName(
  fileName: string,
  namingPattern: FileNamingPattern = "kebab-case"
): Promise<string> {
  return normalizeFileNameAsync(fileName, namingPattern);
}

/**
 * Async version using change-case library for transformation
 * @param fileName - The original filename to normalize
 * @param namingPattern - The naming pattern to apply
 * @returns Promise that resolves to the normalized filename
 */
export async function normalizeFileNameAsync(
  fileName: string,
  namingPattern: FileNamingPattern = "kebab-case"
): Promise<string> {
  switch (namingPattern) {
    case "snake_case": {
      return snakeCase(fileName);
    }
    case "original":
      return fileName;
    case "kebab-case":
    default: {
      return kebabCase(fileName);
    }
  }
}
