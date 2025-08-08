/**
 * New validation system using Zod, sanitize-filename, safe-regex2, and remark
 *
 * This replaces the old home-grown validators with proven open-source libraries.
 */

// Re-export all schemas directly for consumers to use
export { ExtensionConfigSchema } from "./schemas/config.js";
export { FileNameSchema, createFileNameSchema } from "./schemas/fileName.js";
export {
  SearchQuerySchema,
  createSearchQuerySchema,
} from "./schemas/searchQuery.js";
export { PromptSchema, createPromptSchema } from "./schemas/prompt.js";
export { validateMarkdown } from "./markdown.js";
export { z } from "zod";

// Re-export types
export type { ExtensionConfig } from "./schemas/config.js";
export type { PromptContent, FrontMatter } from "./schemas/prompt.js";
export type { FileNameOptions } from "./schemas/fileName.js";

// Export markdown utilities
export * from "./markdown.js";

// Import schemas for validation functions
import { ExtensionConfigSchema } from "./schemas/config.js";
import {
  FileNameSchema,
  createFileNameSchema,
  type FileNameOptions,
} from "./schemas/fileName.js";
import {
  SearchQuerySchema,
  createSearchQuerySchema,
} from "./schemas/searchQuery.js";
import { PromptSchema, createPromptSchema } from "./schemas/prompt.js";
import { validateMarkdown } from "./markdown.js";
import { z } from "zod";

/**
 * Validate extension configuration
 */
export function validateConfig(config: unknown) {
  return ExtensionConfigSchema.safeParse(config);
}

/**
 * Validate and sanitize file name
 */
export function validateFileName(
  fileName: string,
  options?: Parameters<typeof createFileNameSchema>[0]
) {
  const schema = options ? createFileNameSchema(options) : FileNameSchema;
  return schema.safeParse(fileName);
}

/**
 * Validate search query
 */
export function validateSearchQuery(
  query: unknown,
  options?: Parameters<typeof createSearchQuerySchema>[0]
) {
  const schema = options ? createSearchQuerySchema(options) : SearchQuerySchema;
  return schema.safeParse(query);
}

/**
 * Validate prompt content (synchronous)
 */
export function validatePrompt(
  prompt: unknown,
  options?: Parameters<typeof createPromptSchema>[0]
) {
  const schema = options ? createPromptSchema(options) : PromptSchema;
  return schema.safeParse(prompt);
}

/**
 * Validate prompt content with full markdown processing (async)
 */
export async function validatePromptWithMarkdown(
  content: string,
  options?: Parameters<typeof createPromptSchema>[0]
) {
  const schema = options ? createPromptSchema(options) : PromptSchema;

  // Validate the prompt structure
  const promptResult = schema.safeParse({ content });

  // Also run full markdown validation
  const markdownResult = await validateMarkdown(content);

  return {
    prompt: promptResult,
    markdown: markdownResult,
  };
}

/**
 * Quick validation functions that return boolean results
 */
export function isValidConfig(config: unknown): boolean {
  return validateConfig(config).success;
}

export function isValidFileName(fileName: string): boolean {
  return validateFileName(fileName).success;
}

export function isValidSearchQuery(query: unknown): boolean {
  return validateSearchQuery(query).success;
}

export function isValidPrompt(prompt: unknown): boolean {
  return validatePrompt(prompt).success;
}

/**
 * Sanitization functions that return cleaned values
 */
export function sanitizeConfig(config: unknown): any {
  const result = validateConfig(config);
  return result.success ? result.data : config;
}

export function sanitizeFileName(
  fileName: string,
  options?: FileNameOptions
): string {
  const result = validateFileName(fileName, options);
  return result.success ? result.data : fileName;
}

export function sanitizeSearchQuery(query: unknown): any {
  const result = validateSearchQuery(query);
  return result.success ? result.data : query;
}

export function sanitizePrompt(prompt: unknown): any {
  const result = validatePrompt(prompt);
  return result.success ? result.data : prompt;
}

/**
 * Utility functions for working with Zod results
 */
export function getErrorMessages(
  result: z.SafeParseReturnType<any, any>
): string[] {
  if (result.success) {
    return [];
  }
  return result.error.errors.map((err) => err.message);
}

/**
 * Parse a value with error handling
 */
export function parseWithSchema<T>(schema: z.ZodSchema<T>, value: unknown): T {
  return schema.parse(value);
}

/**
 * Safe parse a value (no exceptions)
 */
export function safeParseWithSchema<T>(
  schema: z.ZodSchema<T>,
  value: unknown
): z.SafeParseReturnType<unknown, T> {
  return schema.safeParse(value);
}

/**
 * Legacy compatibility - object with all validation functions
 * @deprecated Use individual functions directly instead
 */
export const validationService = {
  validateConfig,
  validateFileName,
  validateSearchQuery,
  validatePrompt,
  validatePromptWithMarkdown,
  isValidConfig,
  isValidFileName,
  isValidSearchQuery,
  isValidPrompt,
  sanitizeConfig,
  sanitizeFileName,
  sanitizeSearchQuery,
  sanitizePrompt,
};

/**
 * Additional type exports for backward compatibility
 */
export type SearchQuery = import("./schemas/searchQuery.js").SearchQuery;
