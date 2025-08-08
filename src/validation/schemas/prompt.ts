import { z } from "zod";
import matter from "gray-matter";
import {
  validateMarkdownSync,
  extractFrontMatter,
  FRONT_MATTER_FIELDS,
} from "../markdown.js";
import compact from "lodash-es/compact.js";
import uniq from "lodash-es/uniq.js";
import trim from "lodash-es/trim.js";

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
 * Prompt validation options – currently only maxContentLength is honoured
 */
export interface PromptValidationOptions {
  maxContentLength?: number; // bytes
  [key: string]: any; // allow arbitrary properties (ignored)
}

/**
 * Create a *very* relaxed prompt schema that only enforces maximum size.
 */
export function createPromptSchema(options: PromptValidationOptions = {}) {
  const maxContentLength = options.maxContentLength ?? 50 * 1024 * 1024; // 50 MB

  return z.object({
    content: z
      .string()
      .max(
        maxContentLength,
        `Prompt content exceeds maximum length of ${maxContentLength} characters`
      ),

    // Validate front matter structure if present
    frontMatter: FrontMatterSchema.optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
  });
}

/**
 * Default relaxed prompt schema (50 MB cap)
 */
export const PromptSchema = createPromptSchema();

/**
 * Type inference
 */
export type PromptContent = z.infer<typeof PromptSchema>;
export type FrontMatter = z.infer<typeof FrontMatterSchema>;

/**
 * Synchronous version of parsePromptContent for backward compatibility
 * Does not perform markdown validation, only front matter extraction and basic validation
 */
export function parsePromptContentSync(
  rawContent: string,
  fileName?: string
): PromptContent {
  // Extract front matter from raw markdown using gray-matter directly
  const { frontMatter, body } = extractFrontMatter(rawContent);

  const promptData: any = {
    content: body,
    frontMatter: frontMatter || undefined,
  };

  // Set top-level fields from front matter for convenience
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

  // If no title from front matter, try to extract from first heading
  if (!promptData.title) {
    const headingMatch = body.match(/^#\s+(.+)$/m);
    if (headingMatch && headingMatch[1]) {
      promptData.title = headingMatch[1].trim();
    } else if (fileName) {
      // Fall back to filename conversion
      promptData.title = fileName.replace(/-/g, " ");
    }
  }

  // Validate using relaxed schema (size + frontmatter only)
  return createPromptSchema().parse(promptData);
}

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
 * Legacy interface for backward compatibility with PromptParser
 */
export interface ParsedPromptContent {
  frontMatter: any;
  content: string;
  title: string;
  description?: string;
  tags: string[];
}

/**
 * Legacy interface for backward compatibility with PromptParser
 */
export interface PromptMetadata {
  title?: string;
  description?: string;
  tags?: string[] | string;
  [key: string]: any;
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

  if (prompt.description !== undefined) {
    data.description = prompt.description;
  }

  if (prompt.tags !== undefined) {
    data.tags = prompt.tags;
  }

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
