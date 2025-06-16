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
 * Get or create the remark processor
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
    remarkLint,
  ] = await Promise.all([
    import("remark"),
    import("remark-parse"),
    import("remark-stringify"),
    import("remark-frontmatter"),
    import("remark-lint"),
  ]);

  processorCache = remark()
    .use(remarkParse.default)
    .use(remarkFrontmatter.default, ["yaml", "toml"])
    .use(remarkLint.default)
    .use(remarkStringify.default);

  return processorCache;
}

/**
 * Extract front matter from markdown content
 */
export function extractFrontMatter(content: string): {
  frontMatter?: FrontMatterData;
  body: string;
} {
  const frontMatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);

  if (!frontMatterMatch) {
    return { body: content };
  }

  const frontMatterYaml = frontMatterMatch[1];
  const body = content.slice(frontMatterMatch[0].length);

  try {
    // Simple YAML parsing for basic front matter
    const frontMatter: FrontMatterData = {};
    const lines = frontMatterYaml.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const colonIndex = trimmed.indexOf(":");
      if (colonIndex === -1) {
        continue;
      }

      const key = trimmed.slice(0, colonIndex).trim();
      let value = trimmed.slice(colonIndex + 1).trim();

      // Only extract fields that are defined in the FrontMatterData interface
      if (!FRONT_MATTER_FIELDS.includes(key as FrontMatterFieldName)) {
        continue; // Ignore unknown fields
      }

      // Remove quotes if present
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      // Handle specific field types
      if (key === "title" || key === "description") {
        frontMatter[key] = value;
      } else if (key === "tags") {
        // Handle tags as array (comma-separated values or arrays)
        if (value.includes(",")) {
          frontMatter.tags = value.split(",").map((tag) => tag.trim());
        } else if (value.startsWith("[") && value.endsWith("]")) {
          // Handle array format: [tag1, tag2, tag3]
          const arrayContent = value.slice(1, -1);
          frontMatter.tags = arrayContent
            .split(",")
            .map((tag) => tag.trim().replace(/^["']|["']$/g, ""))
            .filter((tag) => tag.length > 0);
        } else {
          // Single tag
          frontMatter.tags = [value];
        }
      }
    }

    return { frontMatter, body };
  } catch (error) {
    // If parsing fails, treat as no front matter
    return { body: content };
  }
}

/**
 * Basic markdown content quality checks
 */
function performQualityChecks(content: string): MarkdownIssue[] {
  const issues: MarkdownIssue[] = [];
  const lines = content.split("\n");

  // Check for minimum content length
  const nonEmptyLines = lines.filter((line) => line.trim().length > 0);
  if (nonEmptyLines.length < 3) {
    issues.push({
      line: 1,
      message:
        "Content seems very short for a prompt (less than 3 non-empty lines)",
      severity: "warning",
      ruleId: "content-length",
    });
  }

  // Check for TODOs and FIXMEs
  lines.forEach((line, index) => {
    const lowerLine = line.toLowerCase();
    if (lowerLine.includes("todo") || lowerLine.includes("fixme")) {
      issues.push({
        line: index + 1,
        message: "Content contains TODO or FIXME markers",
        severity: "info",
        ruleId: "todo-fixme",
      });
    }
  });

  // Check for placeholder text
  const placeholders = [
    "lorem ipsum",
    "placeholder",
    "example text",
    "sample text",
  ];
  const contentLower = content.toLowerCase();

  placeholders.forEach((placeholder) => {
    if (contentLower.includes(placeholder)) {
      const lineIndex = lines.findIndex((line) =>
        line.toLowerCase().includes(placeholder)
      );
      issues.push({
        line: lineIndex + 1,
        message: `Content appears to contain placeholder text: "${placeholder}"`,
        severity: "warning",
        ruleId: "placeholder-text",
      });
    }
  });

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
 * Advanced markdown structure validation
 */
function validateMarkdownStructure(content: string): MarkdownIssue[] {
  const issues: MarkdownIssue[] = [];
  const lines = content.split("\n");

  // Check for heading structure
  const headingPattern = /^#+\s/;
  const headings = lines
    .map((line, index) => ({ line: line.trim(), index: index + 1 }))
    .filter(({ line }) => headingPattern.test(line));

  if (headings.length === 0) {
    issues.push({
      line: 1,
      message: "Document has no headings - consider adding structure",
      severity: "info",
      ruleId: "no-headings",
    });
  }

  // Check for proper heading hierarchy
  let lastHeadingLevel = 0;
  headings.forEach(({ line, index }) => {
    const level = (line.match(/^#+/) || [""])[0].length;
    if (level > lastHeadingLevel + 1) {
      issues.push({
        line: index,
        message: `Heading level ${level} follows level ${lastHeadingLevel} - consider using sequential levels`,
        severity: "warning",
        ruleId: "heading-hierarchy",
      });
    }
    lastHeadingLevel = level;
  });

  // Check for empty links and images
  const emptyLinkPattern = /\[([^\]]*)\]\(\s*\)/g;
  const emptyImagePattern = /!\[([^\]]*)\]\(\s*\)/g;

  lines.forEach((line, index) => {
    if (emptyLinkPattern.test(line)) {
      issues.push({
        line: index + 1,
        message: "Empty link found",
        severity: "warning",
        ruleId: "empty-link",
      });
    }

    if (emptyImagePattern.test(line)) {
      issues.push({
        line: index + 1,
        message: "Empty image reference found",
        severity: "warning",
        ruleId: "empty-image",
      });
    }
  });

  return issues;
}

/**
 * Validate markdown content with comprehensive checks
 */
export async function validateMarkdown(
  content: string
): Promise<MarkdownValidationResult> {
  const issues: MarkdownIssue[] = [];

  try {
    // Extract front matter
    const { frontMatter, body } = extractFrontMatter(content);

    // Process with remark (if available)
    try {
      const processor = await getProcessor();
      const file = await processor.process(body);

      // Add remark messages as issues
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

    // Perform quality checks
    const qualityIssues = performQualityChecks(body);
    issues.push(...qualityIssues);

    // Validate markdown structure
    const structureIssues = validateMarkdownStructure(body);
    issues.push(...structureIssues);

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
 * Quick markdown validation (synchronous, basic checks only)
 */
export function validateMarkdownSync(
  content: string
): MarkdownValidationResult {
  const issues: MarkdownIssue[] = [];

  try {
    // Extract front matter
    const { frontMatter, body } = extractFrontMatter(content);

    // Perform quality checks
    const qualityIssues = performQualityChecks(body);
    issues.push(...qualityIssues);

    // Basic structure validation
    const structureIssues = validateMarkdownStructure(body);
    issues.push(...structureIssues);

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
