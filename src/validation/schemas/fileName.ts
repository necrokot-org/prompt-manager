import { z } from "zod";
import sanitizeFilename from "sanitize-filename";
import { kebabCase, snakeCase } from "change-case";
import validFilename from "valid-filename";

/**
 * File naming patterns
 */
export type FileNamingPattern = "kebab-case" | "snake_case" | "original";

/**
 * Get file extension including the dot
 */
function getExtension(fileName: string): string {
  const lastDotIndex = fileName.lastIndexOf(".");
  return lastDotIndex > 0 ? fileName.substring(lastDotIndex) : "";
}

/**
 * Remove file extension
 */
function removeExtension(fileName: string): string {
  const lastDotIndex = fileName.lastIndexOf(".");
  return lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;
}

/**
 * Format name according to the specified pattern using change-case library
 * @param pattern - The naming pattern to apply
 * @param raw - The raw filename to transform
 * @returns Promise that resolves to the formatted filename
 */
export async function formatName(
  pattern: FileNamingPattern,
  raw: string
): Promise<string> {
  // Extract extension before transformation
  const extension = getExtension(raw);
  const nameWithoutExt = removeExtension(raw);

  let transformedName: string;

  switch (pattern) {
    case "kebab-case": {
      transformedName = kebabCase(nameWithoutExt);
      break;
    }
    case "snake_case": {
      transformedName = snakeCase(nameWithoutExt);
      break;
    }
    case "original":
    default:
      transformedName = nameWithoutExt;
      break;
  }

  return transformedName + extension;
}

/**
 * Synchronous format name function using change-case
 * @param pattern - The naming pattern to apply
 * @param raw - The raw filename to transform
 * @returns The formatted filename
 */
async function formatNameAsync(
  pattern: FileNamingPattern,
  raw: string
): Promise<string> {
  return formatName(pattern, raw);
}

/**
 * Comprehensive file name validation using valid-filename library
 * @param fileName - The filename to validate
 * @param options - Validation options
 * @returns Promise that resolves to validation result
 */
async function validateFileNameSafety(
  fileName: string,
  options: { allowUnicode?: boolean; allowSpaces?: boolean } = {}
): Promise<{ valid: boolean; message?: string }> {
  if (!validFilename(fileName)) {
    return {
      valid: false,
      message: "File name contains invalid characters or uses reserved names",
    };
  }

  // Additional checks for options not covered by valid-filename
  if (!options.allowSpaces && fileName.includes(" ")) {
    return { valid: false, message: "File name contains spaces" };
  }

  if (!options.allowUnicode && /[^\x00-\x7F]/.test(fileName)) {
    return {
      valid: false,
      message: "File name contains non-ASCII characters",
    };
  }

  return { valid: true };
}

/**
 * Suspicious file extensions that should be flagged
 */
const SUSPICIOUS_EXTENSIONS = [
  ".exe",
  ".bat",
  ".cmd",
  ".scr",
  ".com",
  ".pif",
  ".js",
  ".vbs",
  ".jar",
];

/**
 * Check for suspicious file extension
 */
function hasSuspiciousExtension(fileName: string): boolean {
  const extension = getExtension(fileName).toLowerCase();
  return SUSPICIOUS_EXTENSIONS.includes(extension);
}

/**
 * File name validation options
 */
export interface FileNameOptions {
  namingPattern?: FileNamingPattern;
  maxLength?: number;
  allowSpaces?: boolean;
  allowUnicode?: boolean;
  requiredExtension?: string;
  allowedExtensions?: string[];
}

/**
 * Create file name schema with custom options
 */
export function createFileNameSchema(options: FileNameOptions = {}) {
  const {
    namingPattern = "kebab-case",
    maxLength = 255,
    allowSpaces = false,
    allowUnicode = false,
    requiredExtension,
    allowedExtensions = [],
  } = options;

  return (
    z
      .string()
      .min(1, "File name cannot be empty")
      .transform((val) => sanitizeFilename(val.trim(), { replacement: "_" }))
      .refine((val) => val.length > 0, {
        message: "File name cannot be empty after sanitization",
      })
      // Zod handles length validation
      .refine((val) => val.length <= maxLength, {
        message: `File name exceeds maximum length of ${maxLength} characters`,
      })
      // File name safety validation using valid-filename library
      .refine(
        async (val) => {
          const result = await validateFileNameSafety(val, {
            allowUnicode,
            allowSpaces,
          });
          return result.valid;
        },
        {
          message:
            "File name contains invalid characters or uses reserved names",
        }
      )
      // Zod handles extension validation
      .refine(
        (val) => !requiredExtension || getExtension(val) === requiredExtension,
        { message: `File must have ${requiredExtension} extension` }
      )
      .refine(
        (val) =>
          allowedExtensions.length === 0 ||
          allowedExtensions.includes(getExtension(val)),
        {
          message: `File extension must be one of: ${allowedExtensions.join(
            ", "
          )}`,
        }
      )
      // Apply formatting using change-case
      .transform(async (val) => await formatName(namingPattern, val))
      // Warning for suspicious extensions (non-blocking)
      .refine(
        (val) => {
          // This always returns true but logs the warning
          if (hasSuspiciousExtension(val)) {
            console.warn(`File has suspicious extension: ${val}`);
          }
          return true;
        },
        { message: "File has suspicious extension" }
      )
  );
}

/**
 * Default file name schema for prompts
 */
export const FileNameSchema = createFileNameSchema({
  namingPattern: "kebab-case",
  maxLength: 255,
  allowSpaces: false,
  allowUnicode: false,
  allowedExtensions: [".md", ".txt", ""],
});

/**
 * Strict file name schema for security-sensitive contexts
 */
export const StrictFileNameSchema = createFileNameSchema({
  namingPattern: "kebab-case",
  maxLength: 100,
  allowSpaces: false,
  allowUnicode: false,
});

/**
 * Flexible file name schema for user content
 */
export const FlexibleFileNameSchema = createFileNameSchema({
  namingPattern: "original",
  maxLength: 255,
  allowSpaces: true,
  allowUnicode: true,
});

/**
 * Type inference
 */
export type ValidFileName = z.infer<typeof FileNameSchema>;

/**
 * Utility functions for external use
 */
export { sanitizeFilename as sanitizeFileName };
export { getExtension, removeExtension, hasSuspiciousExtension };
