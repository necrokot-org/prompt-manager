import compact from "lodash-es/compact.js";
import trim from "lodash-es/trim.js";
import matter from "gray-matter";

export interface ParsedPromptContent {
  frontMatter: any;
  content: string;
  title: string;
  description?: string;
  tags: string[];
}

export interface PromptMetadata {
  title?: string;
  description?: string;
  tags?: string[] | string;
  [key: string]: any;
}

export class PromptParser {
  /**
   * Parse YAML front matter and content from a prompt file
   */
  public parsePromptContent(
    content: string,
    fileName?: string
  ): ParsedPromptContent {
    const { frontMatter, content: bodyContent } =
      this.parseYamlContent(content);

    // Extract title from front matter or use file name
    const title =
      frontMatter.title ||
      (fileName ? fileName.replace(/-/g, " ") : "Untitled");

    // Extract description
    const description = frontMatter.description;

    // Extract and normalize tags
    let tags: string[] = [];
    if (frontMatter.tags) {
      if (Array.isArray(frontMatter.tags)) {
        tags = frontMatter.tags;
      } else if (typeof frontMatter.tags === "string") {
        // Handle comma-separated tags as string
        tags = compact(frontMatter.tags.split(",").map(trim));
      }
    }

    return {
      frontMatter,
      content: bodyContent,
      title,
      description,
      tags,
    };
  }

  /**
   * Parse YAML front matter and separate it from content using gray-matter
   */
  public parseYamlContent(content: string): {
    frontMatter: any;
    content: string;
  } {
    const { data: frontMatter, content: body } = matter(content);
    return { frontMatter, content: trim(body) };
  }

  /**
   * Create a complete prompt file content with front matter using gray-matter
   */
  public createPromptFile(metadata: PromptMetadata, content: string): string {
    return matter.stringify(content, metadata);
  }

  /**
   * Extract content without YAML front matter
   */
  public extractBodyContent(content: string): string {
    const { content: bodyContent } = this.parseYamlContent(content);
    return bodyContent;
  }

  /**
   * Extract only the front matter
   */
  public extractFrontMatter(content: string): any {
    const { frontMatter } = this.parseYamlContent(content);
    return frontMatter;
  }

  /**
   * Update front matter in existing content
   */
  public updateFrontMatter(
    content: string,
    newMetadata: Partial<PromptMetadata>
  ): string {
    const { frontMatter, content: bodyContent } =
      this.parseYamlContent(content);

    // Merge existing front matter with new metadata
    const updatedFrontMatter = { ...frontMatter, ...newMetadata };

    // Create new content with updated front matter
    return this.createPromptFile(updatedFrontMatter, bodyContent);
  }

  /**
   * Validate YAML front matter structure
   */
  public validateFrontMatter(frontMatter: any): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check for required fields (none are strictly required, but warn about common issues)
    if (
      frontMatter.tags &&
      !Array.isArray(frontMatter.tags) &&
      typeof frontMatter.tags !== "string"
    ) {
      errors.push("Tags should be an array or comma-separated string");
    }

    if (frontMatter.title && typeof frontMatter.title !== "string") {
      errors.push("Title should be a string");
    }

    if (
      frontMatter.description &&
      typeof frontMatter.description !== "string"
    ) {
      errors.push("Description should be a string");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
