import { z } from "zod";
import matter from "gray-matter";
import {
  validateMarkdownSync,
  extractFrontMatter,
  FRONT_MATTER_FIELDS,
} from "../markdown.js";
import { compact, uniq, trim } from "lodash";

/**
 * Front matter schema for prompt metadata
 */
export const FrontMatterSchema = z
  .object({
    title: z
      .string()
      .min(1, "Title cannot be empty")
      .max(100, "Title is too long (max 100 characters)")
      .optional(),

    description: z
      .string()
      .max(500, "Description is too long (max 500 characters)")
      .optional(),

    tags: z
      .array(
        z.string().min(1, "Tag cannot be empty").max(50, "Tag is too long")
      )
      .max(20, "Too many tags (max 20)")
      .optional()
      .transform((tags) => {
        // Remove duplicates and empty tags using lodash
        if (!tags) {
          return undefined;
        }
        const uniqueTags = uniq(compact(tags.map(trim)));
        return uniqueTags.length > 0 ? uniqueTags : undefined;
      }),
  })
  .strict();

/**
 * Full prompt content schema
 */
export const PromptContentSchema = z
  .object({
    content: z
      .string()
      .min(1, "Prompt content cannot be empty")
      .max(500000, "Prompt content is too large (max 500KB)")
      .refine((content) => trim(content).length > 0, {
        message: "Prompt content cannot be only whitespace",
      }),

    frontMatter: FrontMatterSchema.optional(),

    // Derived fields (computed during validation)
    title: z.string().optional(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
  })
  .transform((data) => {
    // Merge front matter into top-level fields
    const result = { ...data };

    if (data.frontMatter) {
      result.title = data.title || data.frontMatter.title;
      result.description = data.description || data.frontMatter.description;
      result.tags = data.tags || data.frontMatter.tags;
    }

    return result;
  });

/**
 * Prompt validation options
 */
export interface PromptValidationOptions {
  requireTitle?: boolean;
  requireDescription?: boolean;
  maxContentLength?: number;
  maxTagCount?: number;
  allowedTags?: string[];
  validateMarkdown?: boolean;
  strictMode?: boolean;
}

/**
 * Create prompt schema with options
 */
export function createPromptSchema(options: PromptValidationOptions = {}) {
  const {
    requireTitle = false,
    requireDescription = false,
    maxContentLength = 500000,
    maxTagCount = 20,
    allowedTags = [],
    validateMarkdown = true,
    strictMode = false,
  } = options;

  // Build the base schema
  const baseSchema = z.object({
    content: z
      .string()
      .min(1, "Prompt content cannot be empty")
      .max(
        maxContentLength,
        `Prompt content exceeds maximum length of ${maxContentLength} characters`
      )
      .refine((content) => trim(content).length > 0, {
        message: "Prompt content cannot be only whitespace",
      }),

    frontMatter: FrontMatterSchema.optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
  });

  // Create conditional schema based on requirements
  const conditionalSchema = baseSchema.extend({
    title: requireTitle
      ? z.string().min(1, "Title is required")
      : z.string().optional(),
    description: requireDescription
      ? z.string().min(1, "Description is required")
      : z.string().optional(),
  });

  return conditionalSchema.superRefine((data, ctx) => {
    // Validate markdown content if enabled (synchronous only)
    if (validateMarkdown) {
      const markdownResult = validateMarkdownSync(data.content);

      // Add markdown issues as Zod issues
      markdownResult.issues.forEach((issue) => {
        const severity = issue.severity === "error" ? "error" : "warning";

        if (severity === "error" || strictMode) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: issue.message,
            path: ["content"],
            params: {
              line: issue.line,
              column: issue.column,
              ruleId: issue.ruleId,
              severity: issue.severity,
            },
          });
        }
      });

      // Extract and validate front matter from markdown
      if (markdownResult.frontMatter) {
        const frontMatterValidation = FrontMatterSchema.safeParse(
          markdownResult.frontMatter
        );

        if (!frontMatterValidation.success) {
          frontMatterValidation.error.errors.forEach((error) => {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Front matter ${error.message}`,
              path: ["frontMatter", ...(error.path || [])],
            });
          });
        }
      }
    }

    // Validate tags against allowed list
    const allTags = data.tags || data.frontMatter?.tags;
    if (allTags && allowedTags.length > 0) {
      const invalidTags = allTags.filter((tag) => !allowedTags.includes(tag));
      if (invalidTags.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid tags: ${invalidTags.join(
            ", "
          )}. Allowed tags: ${allowedTags.join(", ")}`,
          path: ["tags"],
        });
      }
    }

    // Check tag count
    if (allTags && allTags.length > maxTagCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Too many tags (${allTags.length}), maximum allowed is ${maxTagCount}`,
        path: ["tags"],
      });
    }

    // Content quality checks in strict mode
    if (strictMode) {
      const content = data.content.toLowerCase();

      // Check for placeholder content
      const placeholders = ["lorem ipsum", "placeholder", "example", "sample"];
      const foundPlaceholder = placeholders.find((p) => content.includes(p));
      if (foundPlaceholder) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Content appears to contain placeholder text: "${foundPlaceholder}"`,
          path: ["content"],
        });
      }

      // Check minimum content quality
      const lines = compact(
        data.content
          .split("\n")
          .map(trim)
          .filter((line) => line.length > 0)
      );
      if (lines.length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Content seems very short (less than 3 non-empty lines)",
          path: ["content"],
        });
      }
    }
  });
}

/**
 * Default prompt schema
 */
export const PromptSchema = createPromptSchema();

/**
 * Type inference
 */
export type PromptContent = z.infer<typeof PromptSchema>;
export type FrontMatter = z.infer<typeof FrontMatterSchema>;

/**
 * Utility function to parse prompt with front matter extraction
 */
export async function parsePromptContent(
  rawContent: string
): Promise<PromptContent> {
  // This will be implemented to extract front matter from raw markdown
  const { frontMatter, body } = extractFrontMatter(rawContent);

  const promptData: any = {
    content: body,
    frontMatter: frontMatter || undefined,
  };

  // Also set top-level fields from front matter for convenience
  if (frontMatter) {
    if (frontMatter.title) {
      promptData.title = frontMatter.title;
    }
    if (frontMatter.description) {
      promptData.description = frontMatter.description;
    }
    if (frontMatter.tags) {
      promptData.tags = frontMatter.tags;
    }
  }

  return PromptSchema.parse(promptData);
}

/**
 * Utility function to serialize prompt content with front matter using gray-matter
 */
export function serializePromptContent(prompt: PromptContent): string {
  // Build the data object for front matter
  const data: any = {};

  // Add title, description, and tags from top-level properties or frontMatter
  if (prompt.title) {
    data.title = prompt.title;
  }
  if (prompt.description) {
    data.description = prompt.description;
  }
  if (prompt.tags && prompt.tags.length > 0) {
    data.tags = prompt.tags;
  }

  // Add any additional front matter fields
  if (prompt.frontMatter) {
    Object.entries(prompt.frontMatter).forEach(([key, value]) => {
      if (!FRONT_MATTER_FIELDS.includes(key as any)) {
        data[key] = value;
      }
    });
  }

  // Use gray-matter to stringify with front matter if we have any data
  if (Object.keys(data).length > 0) {
    return matter.stringify(prompt.content, data);
  }

  // If no front matter, just return the content
  return prompt.content;
}
