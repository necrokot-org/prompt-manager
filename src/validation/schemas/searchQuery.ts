import { z } from "zod";
import safeRegex from "safe-regex2";
import { trim } from "lodash";

/**
 * Search query types
 */
export const SearchQueryType = z
  .enum(["simple", "regex", "wildcard", "boolean"])
  .default("simple");

/**
 * Validate regex syntax and security using safe-regex2 and standard RegExp
 */
function validateRegex(query: string): { valid: boolean; error?: string } {
  try {
    // First check if the regex is safe using safe-regex2
    if (!safeRegex(query)) {
      return {
        valid: false,
        error: "Regex pattern is potentially unsafe (ReDoS vulnerability)",
      };
    }

    // Validate with standard RegExp
    new RegExp(query);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: `Invalid regular expression: ${(error as Error).message}`,
    };
  }
}

/**
 * Validate boolean search syntax
 */
function validateBooleanSyntax(query: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check for unbalanced quotes
  const quoteCount = (query.match(/"/g) || []).length;
  if (quoteCount % 2 !== 0) {
    errors.push("Unbalanced quotes in search query");
  }

  // Check for unbalanced parentheses
  const openParens = (query.match(/\(/g) || []).length;
  const closeParens = (query.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    errors.push("Unbalanced parentheses in search query");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Search query validation options
 */
export interface SearchQueryOptions {
  maxLength?: number;
  minLength?: number;
  allowRegex?: boolean;
  allowWildcards?: boolean;
  allowedOperators?: string[];
  bannedTerms?: string[];
}

/**
 * Create search query schema with options
 */
export function createSearchQuerySchema(options: SearchQueryOptions = {}) {
  const {
    maxLength = 1000,
    minLength = 1,
    allowRegex = true,
    allowWildcards = true,
    allowedOperators = ["AND", "OR", "NOT", "+", "-", '"', "*", "?"],
    bannedTerms = [],
  } = options;

  const baseSchema = z.object({
    query: z
      .string()
      .min(minLength, `Search query must be at least ${minLength} characters`)
      .max(maxLength, `Search query cannot exceed ${maxLength} characters`)
      .refine(
        (val) =>
          bannedTerms.length === 0 ||
          !bannedTerms.some((term) =>
            val.toLowerCase().includes(term.toLowerCase())
          ),
        {
          message: `Search query contains banned terms: ${bannedTerms.join(
            ", "
          )}`,
        }
      )
      .transform((val) => trim(val).replace(/\s+/g, " ")), // Normalize whitespace

    type: SearchQueryType,
    caseSensitive: z.boolean().optional().default(false),
    exact: z.boolean().optional().default(false),
    includeYaml: z.boolean().optional().default(false),
  });

  return baseSchema.superRefine((data, ctx) => {
    const { query, type } = data;

    // Type-specific validation
    switch (type) {
      case "regex":
        if (!allowRegex) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Regular expression queries are not allowed",
            path: ["type"],
          });
          break;
        }

        // Simple regex validation - let RegExp constructor handle the rest
        const regexValidation = validateRegex(query);
        if (!regexValidation.valid) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: regexValidation.error || "Invalid regular expression",
            path: ["query"],
          });
        }
        break;

      case "wildcard":
        if (!allowWildcards) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Wildcard queries are not allowed",
            path: ["type"],
          });
        }
        break;

      case "boolean":
        const booleanValidation = validateBooleanSyntax(query);
        if (!booleanValidation.valid) {
          booleanValidation.errors.forEach((error) => {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: error,
              path: ["query"],
            });
          });
        }

        // Check for disallowed operators
        const usedOperators = query.match(/\b(?:AND|OR|NOT)\b|[+\-"*?]/g) || [];
        const disallowedOperators = usedOperators.filter(
          (op) => !allowedOperators.includes(op)
        );
        if (disallowedOperators.length > 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Query uses disallowed operators: ${disallowedOperators.join(
              ", "
            )}`,
            path: ["query"],
          });
        }
        break;
    }
  });
}

/**
 * Default search query schema
 */
export const SearchQuerySchema = createSearchQuerySchema();

/**
 * Type inference
 */
export type SearchQuery = z.infer<typeof SearchQuerySchema>;
export type SearchQueryTypeValue = z.infer<typeof SearchQueryType>;

/**
 * Utility functions
 */
export { validateRegex };
