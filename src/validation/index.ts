/**
 * New validation system using Zod, sanitize-filename, re2, and remark
 *
 * This replaces the old home-grown validators with proven open-source libraries.
 */

// Export schemas
export * from "./schemas/config.js";
export * from "./schemas/fileName.js";
export * from "./schemas/searchQuery.js";
export * from "./schemas/prompt.js";

// Export markdown utilities
export * from "./markdown.js";

// Re-export for convenience
import { ExtensionConfigSchema } from "./schemas/config.js";
import { FileNameSchema, createFileNameSchema } from "./schemas/fileName.js";
import {
  SearchQuerySchema,
  createSearchQuerySchema,
} from "./schemas/searchQuery.js";
import { PromptSchema, createPromptSchema } from "./schemas/prompt.js";
import { validateMarkdown } from "./markdown.js";
import { z } from "zod";

/**
 * Centralized validation service with direct Zod integration
 */
export class ValidationService {
  /**
   * Validate extension configuration
   */
  validateConfig(config: unknown) {
    return ExtensionConfigSchema.safeParse(config);
  }

  /**
   * Validate and sanitize file name
   */
  validateFileName(
    fileName: string,
    options?: Parameters<typeof createFileNameSchema>[0]
  ) {
    const schema = options ? createFileNameSchema(options) : FileNameSchema;
    return schema.safeParse(fileName);
  }

  /**
   * Validate search query
   */
  validateSearchQuery(
    query: unknown,
    options?: Parameters<typeof createSearchQuerySchema>[0]
  ) {
    const schema = options
      ? createSearchQuerySchema(options)
      : SearchQuerySchema;
    return schema.safeParse(query);
  }

  /**
   * Validate prompt content (synchronous)
   */
  validatePrompt(
    prompt: unknown,
    options?: Parameters<typeof createPromptSchema>[0]
  ) {
    const schema = options ? createPromptSchema(options) : PromptSchema;
    return schema.safeParse(prompt);
  }

  /**
   * Validate prompt content with full markdown processing (async)
   */
  async validatePromptWithMarkdown(
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
   * Quick validation methods that return boolean results
   */
  isValidConfig(config: unknown): boolean {
    return this.validateConfig(config).success;
  }

  isValidFileName(fileName: string): boolean {
    return this.validateFileName(fileName).success;
  }

  isValidSearchQuery(query: unknown): boolean {
    return this.validateSearchQuery(query).success;
  }

  isValidPrompt(prompt: unknown): boolean {
    return this.validatePrompt(prompt).success;
  }

  /**
   * Sanitization methods that return cleaned values
   */
  sanitizeConfig(config: unknown): any {
    const result = this.validateConfig(config);
    return result.success ? result.data : config;
  }

  sanitizeFileName(fileName: string): string {
    const result = this.validateFileName(fileName);
    return result.success ? result.data : fileName;
  }

  sanitizeSearchQuery(query: unknown): any {
    const result = this.validateSearchQuery(query);
    return result.success ? result.data : query;
  }

  sanitizePrompt(prompt: unknown): any {
    const result = this.validatePrompt(prompt);
    return result.success ? result.data : prompt;
  }
}

/**
 * Global validation service instance
 */
export const validationService = new ValidationService();

/**
 * Convenience functions for quick validation
 */
export const validate = {
  config: (config: unknown) => validationService.validateConfig(config),
  fileName: (
    fileName: string,
    options?: Parameters<typeof createFileNameSchema>[0]
  ) => validationService.validateFileName(fileName, options),
  searchQuery: (
    query: unknown,
    options?: Parameters<typeof createSearchQuerySchema>[0]
  ) => validationService.validateSearchQuery(query, options),
  prompt: (
    prompt: unknown,
    options?: Parameters<typeof createPromptSchema>[0]
  ) => validationService.validatePrompt(prompt, options),
  promptWithMarkdown: (
    content: string,
    options?: Parameters<typeof createPromptSchema>[0]
  ) => validationService.validatePromptWithMarkdown(content, options),
};

/**
 * Convenience functions for quick sanitization
 */
export const sanitize = {
  config: (config: unknown) => validationService.sanitizeConfig(config),
  fileName: (fileName: string) => validationService.sanitizeFileName(fileName),
  searchQuery: (query: unknown) => validationService.sanitizeSearchQuery(query),
  prompt: (prompt: unknown) => validationService.sanitizePrompt(prompt),
};

/**
 * Convenience functions for quick validation checks
 */
export const isValid = {
  config: (config: unknown) => validationService.isValidConfig(config),
  fileName: (fileName: string) => validationService.isValidFileName(fileName),
  searchQuery: (query: unknown) => validationService.isValidSearchQuery(query),
  prompt: (prompt: unknown) => validationService.isValidPrompt(prompt),
};

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

export function getFirstError(
  result: z.SafeParseReturnType<any, any>
): string | undefined {
  if (result.success) {
    return undefined;
  }
  return result.error.errors[0]?.message;
}

export function formatZodError(
  result: z.SafeParseReturnType<any, any>
): string {
  if (result.success) {
    return "";
  }
  return result.error.errors
    .map((err) => {
      const path = err.path.length > 0 ? `${err.path.join(".")}: ` : "";
      return `${path}${err.message}`;
    })
    .join("; ");
}

/**
 * Type aliases for backward compatibility
 */
export type ExtensionConfiguration =
  import("./schemas/config.js").ExtensionConfig;
export type SearchQuery = import("./schemas/searchQuery.js").SearchQuery;
export type PromptContent = import("./schemas/prompt.js").PromptContent;
