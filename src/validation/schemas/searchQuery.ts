import { z } from "zod";
import safeRegex from "safe-regex2";
import { SearchScope } from "@features/search/core/FlexSearchService";

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
 * Search query validation options
 */
export interface SearchQueryOptions {
  maxLength?: number;
  minLength?: number;
  allowRegex?: boolean;
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
      .transform((val) => val.trim().replace(/\s+/g, " ")), // Normalize whitespace

    caseSensitive: z.boolean().optional().default(false),
    fuzzy: z
      .object({
        enabled: z.boolean(),
        distance: z
          .union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)])
          .optional(),
        tokenizer: z
          .enum(["tolerant", "forward", "reverse", "full"] as [
            "tolerant",
            "forward",
            "reverse",
            "full"
          ])
          .optional(),
        encoder: z
          .enum(["normalize", "balance", "advanced", "extra", "soundex"] as [
            "normalize",
            "balance",
            "advanced",
            "extra",
            "soundex"
          ])
          .optional(),
        languagePreset: z
          .enum(["en", "de", "fr", "es", "it", "pt", "ru", "zh"] as [
            "en",
            "de",
            "fr",
            "es",
            "it",
            "pt",
            "ru",
            "zh"
          ])
          .optional(),
        suggest: z.boolean().optional(),
      })
      .optional(),
    scope: z.nativeEnum(SearchScope).default(SearchScope.ALL),
    maxSuggestions: z.number().min(1).max(20).optional().default(5),
  });

  return baseSchema.superRefine((data, ctx) => {
    const { query } = data;

    // Optional regex validation if the query looks like a regex pattern
    if (allowRegex && query.startsWith("/") && query.endsWith("/")) {
      const regexPattern = query.slice(1, -1); // Remove leading and trailing slashes
      const regexValidation = validateRegex(regexPattern);
      if (!regexValidation.valid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: regexValidation.error || "Invalid regular expression",
          path: ["query"],
        });
      }
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

/**
 * Utility functions
 */
export { validateRegex };
