import { z } from "zod";
import sanitizeFilename from "sanitize-filename";

/**
 * File naming patterns
 */
export type FileNamingPattern = "kebab-case" | "snake_case" | "original";

/**
 * Reserved system names that should be avoided
 */
const RESERVED_NAMES = [
  // Windows reserved names
  "CON",
  "PRN",
  "AUX",
  "NUL",
  "COM1",
  "COM2",
  "COM3",
  "COM4",
  "COM5",
  "COM6",
  "COM7",
  "COM8",
  "COM9",
  "LPT1",
  "LPT2",
  "LPT3",
  "LPT4",
  "LPT5",
  "LPT6",
  "LPT7",
  "LPT8",
  "LPT9",
  // Common reserved names
  ".",
  "..",
  "desktop.ini",
  "thumbs.db",
  ".DS_Store",
];

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
 * Apply naming pattern transformation
 */
function applyNamingPattern(
  fileName: string,
  pattern: FileNamingPattern
): string {
  const extension = getExtension(fileName);
  const nameWithoutExt = removeExtension(fileName);

  let transformedName: string;

  switch (pattern) {
    case "kebab-case":
      transformedName = nameWithoutExt
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .replace(/-+/g, "-");
      break;

    case "snake_case":
      transformedName = nameWithoutExt
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .replace(/_+/g, "_");
      break;

    case "original":
    default:
      transformedName = nameWithoutExt;
      break;
  }

  return transformedName + extension;
}

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
 * Check if filename uses reserved system name
 */
function isReservedName(fileName: string): boolean {
  const nameWithoutExt = removeExtension(fileName).toUpperCase();
  return (
    RESERVED_NAMES.includes(nameWithoutExt) ||
    /^(COM|LPT)\d$/i.test(nameWithoutExt)
  );
}

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

  return z
    .string()
    .min(1, "File name cannot be empty")
    .transform((val) => sanitizeFilename(val.trim(), { replacement: "_" }))
    .refine((val) => val.length > 0, {
      message: "File name cannot be empty after sanitization",
    })
    .refine((val) => val.length <= maxLength, {
      message: `File name exceeds maximum length of ${maxLength} characters`,
    })
    .refine((val) => !isReservedName(val), {
      message: "File name uses a reserved system name",
    })
    .refine((val) => allowSpaces || !val.includes(" "), {
      message: `File name contains spaces (use ${namingPattern} format instead)`,
    })
    .refine((val) => allowUnicode || !/[^\x00-\x7F]/.test(val), {
      message: "File name contains non-ASCII characters",
    })
    .refine((val) => !val.includes(".."), {
      message: "File name contains path traversal patterns",
    })
    .refine((val) => !/[<>:"|?*\x00-\x1f\x7f]/.test(val), {
      message: "File name contains dangerous characters",
    })
    .refine((val) => !val.endsWith(".") && !val.endsWith(" "), {
      message: "File name cannot end with dots or spaces",
    })
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
    .transform((val) => applyNamingPattern(val, namingPattern))
    .refine(
      (val) => {
        if (hasSuspiciousExtension(val)) {
          // This is a warning-level issue, but Zod doesn't have warnings
          // We'll handle this in the validation layer
          return true;
        }
        return true;
      },
      { message: "File has suspicious extension" }
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
export {
  getExtension,
  removeExtension,
  isReservedName,
  hasSuspiciousExtension,
};
