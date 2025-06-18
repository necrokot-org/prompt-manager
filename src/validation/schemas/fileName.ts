import { z } from "zod";
import filenamify from "filenamify";
import trim from "lodash-es/trim.js";
import { normalizeFileName, FileNamingPattern } from "../../utils/string.js";
import { log } from "@infra/vscode/log";

/**
 * Suspicious file extensions that should be flagged (non-blocking warnings)
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

function getExtension(fileName: string): string {
  const lastDotIndex = fileName.lastIndexOf(".");
  return lastDotIndex > 0 ? fileName.substring(lastDotIndex) : "";
}

function removeExtension(fileName: string): string {
  const lastDotIndex = fileName.lastIndexOf(".");
  return lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;
}

function hasSuspiciousExtension(fileName: string): boolean {
  const extension = getExtension(fileName).toLowerCase();
  return SUSPICIOUS_EXTENSIONS.includes(extension);
}

/**
 * File-name validation options – unicode/space checks have been removed as filenamify already guards against them.
 */
export interface FileNameOptions {
  namingPattern?: FileNamingPattern;
  maxLength?: number;
  requiredExtension?: string;
  allowedExtensions?: string[];
}

/**
 * Create a Zod schema that sanitises and normalises a filename.
 *
 * 1. The raw input is trimmed and passed through filenamify with an underscore replacement – this handles all OS-reserved
 *    characters, control characters, reserved words and length truncation edge-cases for us.
 * 2. Optional pattern transformation (kebab-case / snake_case) happens *after* filenamify so we never feed unsafe strings
 *    into slugify.
 */
export function createFileNameSchema(options: FileNameOptions = {}) {
  const {
    namingPattern = "kebab-case",
    maxLength = 255,
    requiredExtension,
    allowedExtensions = [".md", ".txt", ""],
  } = options;

  return (
    z
      .string()
      .min(1, "File name cannot be empty")
      // 1️⃣  Sanitise
      .transform((val) => filenamify(trim(val), { replacement: "_" }))
      .refine((val) => val.length > 0, {
        message: "File name cannot be empty after sanitisation",
      })
      .refine((val) => val.length <= maxLength, {
        message: `File name exceeds maximum length of ${maxLength} characters`,
      })
      // 2️⃣  Extension rules
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
      // 3️⃣  Pattern transformation (kebab-case/snake_case/original)
      .transform((val) => {
        const extension = getExtension(val);
        const nameWithoutExt = removeExtension(val);
        const transformed =
          namingPattern === "original"
            ? nameWithoutExt
            : normalizeFileName(nameWithoutExt, namingPattern);
        return transformed + extension;
      })
      // 4️⃣  Non-blocking suspicious-extension warning
      .refine(
        (val) => {
          if (hasSuspiciousExtension(val)) {
            log.warn(`File has suspicious extension: ${val}`);
          }
          return true;
        },
        { message: "File has suspicious extension" }
      )
  );
}

/**
 * Default schema used across the extension.
 */
export const FileNameSchema = createFileNameSchema();

export type ValidFileName = z.infer<typeof FileNameSchema>;

/** Convenience re-exports */
export {
  filenamify as sanitizeFileName,
  getExtension,
  removeExtension,
  hasSuspiciousExtension,
};
