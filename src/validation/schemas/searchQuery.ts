import { z } from "zod";
import RE2 from "re2";

/**
 * Search query types
 */
export const SearchQueryType = z
  .enum(["simple", "regex", "wildcard", "boolean"])
  .default("simple");

/**
 * Injection patterns to detect potentially dangerous input
 */
const INJECTION_PATTERNS = [
  /['";]|--|\||\|\||&&/g, // SQL injection attempts
  /<script|javascript:|data:/gi, // XSS attempts
  /\$\{|\#\{/g, // Template injection
  /eval\(|exec\(|system\(/gi, // Code execution attempts
  /\.\./g, // Path traversal
];

/**
 * ReDoS (Regular Expression Denial of Service) patterns
 */
const REDOS_PATTERNS = [
  /\([^)]*\+[^)]*\+[^)]*\)/g, // Nested quantifiers
  /\([^)]*\*[^)]*\*[^)]*\)/g, // Multiple wildcards
  /\([^)]*\{[0-9,]+\}.*\{[0-9,]+\}[^)]*\)/g, // Multiple range quantifiers
  /\(\.\*\){2,}/g, // Multiple .* patterns
  /\(\.\+\){2,}/g, // Multiple .+ patterns
];

/**
 * Dangerous regex patterns that should be avoided
 */
const DANGEROUS_REGEX_PATTERNS = [
  /\(\?\#.*\)/g, // Comments in regex
  /\(\?\{/g, // Code execution attempts
  /\\x[0-9a-fA-F]{2}/g, // Hex escapes
  /\\u[0-9a-fA-F]{4}/g, // Unicode escapes
  /\(\?\=/g, // Positive lookahead
  /\(\?\!/g, // Negative lookahead
  /\(\?\<\=/g, // Positive lookbehind
  /\(\?\<\!/g, // Negative lookbehind
  /\(\?\>/g, // Atomic groups
  /\(\?\&/g, // Conditional patterns
];

/**
 * Calculate regex complexity score
 */
function calculateComplexity(query: string): number {
  let complexity = 0;

  // Base complexity from length
  complexity += Math.min(query.length / 10, 20);

  // Add complexity for special characters
  complexity += (query.match(/[.*+?^${}()|[\]\\]/g) || []).length * 2;

  // Add complexity for quantifiers
  complexity += (query.match(/[*+?{]/g) || []).length * 3;

  // Add complexity for alternations
  complexity += (query.match(/\|/g) || []).length * 2;

  // Add complexity for lookarounds
  complexity += (query.match(/\(\?\[!=<]/g) || []).length * 5;

  // Count nested groups
  let maxDepth = 0;
  let currentDepth = 0;
  for (let i = 0; i < query.length; i++) {
    if (query[i] === "(" && (i === 0 || query[i - 1] !== "\\")) {
      currentDepth++;
      maxDepth = Math.max(maxDepth, currentDepth);
    } else if (query[i] === ")" && (i === 0 || query[i - 1] !== "\\")) {
      currentDepth--;
    }
  }
  complexity += maxDepth * 3;

  return Math.round(complexity);
}

/**
 * Validate regex syntax and security
 */
function validateRegex(query: string): { valid: boolean; error?: string } {
  try {
    // Try to compile with RE2 first (safer)
    new RE2(query);
    return { valid: true };
  } catch (error) {
    // If RE2 fails, try with standard RegExp for error message
    try {
      new RegExp(query);
      return {
        valid: false,
        error:
          "Regex is valid but not supported by RE2 engine (potentially unsafe)",
      };
    } catch (regexError) {
      return {
        valid: false,
        error: `Invalid regular expression: ${(regexError as Error).message}`,
      };
    }
  }
}

/**
 * Check for injection attempts
 */
function hasInjectionPatterns(query: string): boolean {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(query));
}

/**
 * Check for ReDoS patterns
 */
function hasReDoSPatterns(query: string): boolean {
  return REDOS_PATTERNS.some((pattern) => pattern.test(query));
}

/**
 * Check for dangerous regex patterns
 */
function hasDangerousPatterns(query: string): boolean {
  return DANGEROUS_REGEX_PATTERNS.some((pattern) => pattern.test(query));
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
  preventInjection?: boolean;
  maxComplexity?: number;
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
    preventInjection = true,
    maxComplexity = 100,
    allowedOperators = ["AND", "OR", "NOT", "+", "-", '"', "*", "?"],
    bannedTerms = [],
  } = options;

  const baseSchema = z.object({
    query: z
      .string()
      .min(minLength, `Search query must be at least ${minLength} characters`)
      .max(maxLength, `Search query cannot exceed ${maxLength} characters`)
      .refine((val) => !preventInjection || !hasInjectionPatterns(val), {
        message: "Search query contains potentially dangerous patterns",
      })
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
      .refine((val) => !/\0/.test(val), {
        message: "Search query contains null bytes",
      })
      .transform((val) => val.trim().replace(/\s+/g, " ")), // Normalize whitespace

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

        // Check for dangerous patterns first
        if (hasDangerousPatterns(query)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Regex contains potentially dangerous patterns",
            path: ["query"],
          });
        }

        // Check for ReDoS patterns
        if (hasReDoSPatterns(query)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Regex may cause performance issues (ReDoS vulnerability)",
            path: ["query"],
          });
        }

        // Validate regex syntax with RE2
        const regexValidation = validateRegex(query);
        if (!regexValidation.valid) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: regexValidation.error || "Invalid regular expression",
            path: ["query"],
          });
        }

        // Check complexity
        const complexity = calculateComplexity(query);
        if (complexity > maxComplexity) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Regex is too complex (score: ${complexity}, max: ${maxComplexity})`,
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
          break;
        }

        // Check for too many wildcards
        const wildcardCount = (query.match(/[*?]/g) || []).length;
        if (wildcardCount > 10) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Too many wildcards may affect performance",
            path: ["query"],
          });
        }

        // Warn about leading wildcards
        if (query.startsWith("*") || query.startsWith("?")) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Leading wildcards can significantly slow down searches",
            path: ["query"],
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

      case "simple":
      default:
        // Check for very short terms that might return too many results
        const terms = query.split(/\s+/).filter((term) => term.length > 0);
        const shortTerms = terms.filter(
          (term) => term.length < 3 && !/[*?]/.test(term)
        );

        if (shortTerms.length > 0 && terms.length === shortTerms.length) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              "All search terms are very short, this might return too many results",
            path: ["query"],
          });
        }
        break;
    }

    // Performance checks for all types
    if (query.length > 500) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Very long search queries may impact performance",
        path: ["query"],
      });
    }

    // Check for excessive special characters
    const specialCharRatio =
      (query.match(/[^\w\s]/g) || []).length / query.length;
    if (specialCharRatio > 0.5) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Query contains excessive special characters",
        path: ["query"],
      });
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
export { validateRegex, calculateComplexity, hasInjectionPatterns };
