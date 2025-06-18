import matter from "gray-matter";
import compact from "lodash-es/compact.js";
import trim from "lodash-es/trim.js";

/**
 * Markdown validation issue
 */
export interface MarkdownIssue {
  line?: number;
  column?: number;
  message: string;
  severity: "error" | "warning" | "info";
  ruleId?: string;
  source?: string;
}

/**
 * Markdown validation result
 */
export interface MarkdownValidationResult {
  isValid: boolean;
  issues: MarkdownIssue[];
  frontMatter?: any;
  content?: string;
}

/**
 * Front matter parsing result
 */
export interface FrontMatterData {
  title?: string;
  description?: string;
  tags?: string[];
}

export type FrontMatterFieldName = keyof FrontMatterData;

export interface FrontMatterData {
  title?: string;
  description?: string;
  tags?: string[];
}

// Array with explicit keys and `as const` for literal types
export const FRONT_MATTER_FIELDS = ["title", "description", "tags"] as const;

// Type to enforce exact key match
type ArrayKeys = typeof FRONT_MATTER_FIELDS;
type InterfaceKeys = keyof FrontMatterData;

// Check 1: No extra keys in array (array keys ⊆ interface keys)
type NoExtraKeys = ArrayKeys[number] extends InterfaceKeys ? true : false;

// Check 2: All interface keys are in array (interface keys ⊆ array keys)
type AllKeysIncluded = InterfaceKeys extends ArrayKeys[number] ? true : false;

// Enforce both conditions at compile time
const _noExtraKeys: NoExtraKeys = true; // Fails if array has invalid keys
const _allKeysIncluded: AllKeysIncluded = true; // Fails if array misses interface keys

/**
 * Cached remark processor
 */
let processorCache: any = null;

/**
 * Get or create the remark processor with comprehensive linting preset
 *
 * The preset includes rules for:
 * - Heading hierarchy and structure
 * - Empty links and images
 * - TODO/FIXME detection
 * - Content quality checks
 * - And many more community-maintained linting rules
 */
async function getProcessor() {
  if (processorCache) {
    return processorCache;
  }

  const [
    { remark },
    remarkParse,
    remarkStringify,
    remarkFrontmatter,
    remarkPresetLintRecommended,
  ] = await Promise.all([
    import("remark"),
    import("remark-parse"),
    import("remark-stringify"),
    import("remark-frontmatter"),
    import("remark-preset-lint-recommended"),
  ]);

  processorCache = remark()
    .use(remarkParse.default)
    .use(remarkFrontmatter.default, ["yaml", "toml"])
    .use(remarkPresetLintRecommended.default) // Comprehensive linting rules
    .use(remarkStringify.default);

  return processorCache;
}

/**
 * Extract front matter from markdown content using gray-matter
 */
export function extractFrontMatter(content: string): {
  frontMatter?: FrontMatterData;
  body: string;
} {
  try {
    const parsed = matter(content);

    // Extract only the fields we care about from the parsed data
    const frontMatter: FrontMatterData = {};
    let hasValidFields = false;

    // Extract fields that are defined in the FrontMatterData interface
    for (const field of FRONT_MATTER_FIELDS) {
      if (parsed.data && field in parsed.data) {
        const value = parsed.data[field];

        if (field === "title" || field === "description") {
          if (typeof value === "string" && trim(value).length > 0) {
            frontMatter[field] = trim(value);
            hasValidFields = true;
          }
        } else if (field === "tags") {
          // Handle tags - can be array or string
          if (Array.isArray(value)) {
            const tags = compact(
              value
                .filter(
                  (tag) => typeof tag === "string" && trim(tag).length > 0
                )
                .map(trim)
            );
            if (tags.length > 0) {
              frontMatter.tags = tags;
              hasValidFields = true;
            }
          } else if (typeof value === "string" && trim(value).length > 0) {
            // Handle comma-separated tags
            const tags = compact(
              value
                .split(",")
                .map(trim)
                .filter((tag) => tag.length > 0)
            );
            if (tags.length > 0) {
              frontMatter.tags = tags;
              hasValidFields = true;
            }
          }
        }
      }
    }

    return {
      frontMatter: hasValidFields ? frontMatter : undefined,
      body: parsed.content,
    };
  } catch (error) {
    // If gray-matter parsing fails, treat as no front matter
    return { body: content };
  }
}

/**
 * Security-specific checks not covered by remark-preset-lint-recommended
 */
function performSecurityChecks(content: string): MarkdownIssue[] {
  const issues: MarkdownIssue[] = [];
  const lines = content.split("\n");

  // Check for security patterns
  const securityPatterns = [
    {
      pattern: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      message: "Content contains script tags",
    },
    {
      pattern: /javascript:|data:text\/html|vbscript:/gi,
      message: "Content contains potentially unsafe URL schemes",
    },
    {
      pattern: /on\w+\s*=/gi,
      message: "Content contains HTML event handlers",
    },
  ];

  securityPatterns.forEach(({ pattern, message }) => {
    const matches = content.match(pattern);
    if (matches) {
      const lineIndex = lines.findIndex((line) => pattern.test(line));
      issues.push({
        line: lineIndex + 1,
        message,
        severity: "warning",
        ruleId: "security-risk",
      });
    }
  });

  return issues;
}

/**
 * Validate markdown content with comprehensive checks
 *
 * Uses remark-preset-lint-recommended for most validation rules including:
 * - Heading hierarchy and structure
 * - Empty links and images
 * - Content quality checks
 * - TODO/FIXME detection
 * - And many more community-maintained rules
 *
 * Only performs custom security checks that aren't covered by the preset.
 */
export async function validateMarkdown(
  content: string
): Promise<MarkdownValidationResult> {
  const issues: MarkdownIssue[] = [];

  try {
    // Extract front matter
    const { frontMatter, body } = extractFrontMatter(content);

    // Process with remark preset for comprehensive linting
    try {
      const processor = await getProcessor();
      const file = await processor.process(body);

      // Add remark messages as issues (preset handles most validation)
      if (file.messages && file.messages.length > 0) {
        file.messages.forEach((message: any) => {
          issues.push({
            line: message.line || undefined,
            column: message.column || undefined,
            message: message.message,
            severity: message.fatal ? "error" : "warning",
            ruleId: message.ruleId || undefined,
            source: message.source || undefined,
          });
        });
      }
    } catch (remarkError) {
      // If remark processing fails, continue with basic validation
      issues.push({
        line: 1,
        message: `Remark processing failed: ${(remarkError as Error).message}`,
        severity: "warning",
        ruleId: "remark-error",
      });
    }

    // Perform security checks (only checks not covered by preset)
    const securityIssues = performSecurityChecks(body);
    issues.push(...securityIssues);

    return {
      isValid: !issues.some((issue) => issue.severity === "error"),
      issues,
      frontMatter,
      content: body,
    };
  } catch (error) {
    issues.push({
      line: 1,
      message: `Markdown processing failed: ${(error as Error).message}`,
      severity: "error",
      ruleId: "processing-error",
    });

    return {
      isValid: false,
      issues,
    };
  }
}

/**
 * Quick markdown validation (synchronous, security checks only)
 *
 * Note: For comprehensive validation including heading structure,
 * empty links, TODO detection, etc., use the async validateMarkdown()
 * function which leverages remark-preset-lint-recommended.
 */
export function validateMarkdownSync(
  content: string
): MarkdownValidationResult {
  const issues: MarkdownIssue[] = [];

  try {
    // Extract front matter
    const { frontMatter, body } = extractFrontMatter(content);

    // Perform security checks only (comprehensive checks require async remark processing)
    const securityIssues = performSecurityChecks(body);
    issues.push(...securityIssues);

    return {
      isValid: !issues.some((issue) => issue.severity === "error"),
      issues,
      frontMatter,
      content: body,
    };
  } catch (error) {
    return {
      isValid: false,
      issues: [
        {
          line: 1,
          message: `Markdown validation failed: ${(error as Error).message}`,
          severity: "error",
          ruleId: "validation-error",
        },
      ],
    };
  }
}

/**
 * Utility to format markdown issues for display
 */
export function formatMarkdownIssues(issues: MarkdownIssue[]): string[] {
  return issues.map((issue) => {
    let message = issue.message;

    if (issue.line) {
      message = `Line ${issue.line}: ${message}`;
      if (issue.column) {
        message = `Line ${issue.line}:${issue.column}: ${message}`;
      }
    }

    if (issue.ruleId) {
      message += ` (${issue.ruleId})`;
    }

    return `[${issue.severity.toUpperCase()}] ${message}`;
  });
}
