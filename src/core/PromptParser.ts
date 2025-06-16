import { compact, trim } from "lodash";

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
   * Parse YAML front matter and separate it from content
   */
  public parseYamlContent(content: string): {
    frontMatter: any;
    content: string;
  } {
    const lines = content.split("\n");

    // Check if file starts with YAML front matter
    if (lines[0] === "---") {
      const endIndex = lines.findIndex(
        (line, index) => index > 0 && line === "---"
      );

      if (endIndex > 0) {
        const yamlLines = lines.slice(1, endIndex);
        const bodyLines = lines.slice(endIndex + 1);

        try {
          // Simple YAML parsing for common front matter fields
          const frontMatter: any = {};

          for (const line of yamlLines) {
            const colonIndex = line.indexOf(":");
            if (colonIndex > 0) {
              const key = trim(line.substring(0, colonIndex));
              let value = trim(line.substring(colonIndex + 1));

              // Remove quotes if present
              if (
                (value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))
              ) {
                value = value.slice(1, -1);
              }

              // Handle arrays (simple format: ["item1", "item2"])
              if (value.startsWith("[") && value.endsWith("]")) {
                try {
                  frontMatter[key] = JSON.parse(value);
                } catch {
                  frontMatter[key] = value;
                }
              } else {
                frontMatter[key] = value;
              }
            }
          }

          return {
            frontMatter,
            content: trim(bodyLines.join("\n")),
          };
        } catch (error) {
          console.warn("Failed to parse YAML front matter:", error);
        }
      }
    }

    return {
      frontMatter: {},
      content: trim(content),
    };
  }

  /**
   * Create YAML front matter string from metadata
   */
  public createFrontMatter(metadata: PromptMetadata): string {
    const lines = ["---"];

    for (const [key, value] of Object.entries(metadata)) {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          lines.push(`${key}: ${JSON.stringify(value)}`);
        } else if (typeof value === "string") {
          // Quote strings that contain special characters
          const needsQuotes =
            value.includes(":") || value.includes('"') || value.includes("'");
          if (needsQuotes) {
            lines.push(`${key}: "${value.replace(/"/g, '\\"')}"`);
          } else {
            lines.push(`${key}: ${value}`);
          }
        } else {
          lines.push(`${key}: ${value}`);
        }
      }
    }

    lines.push("---");
    return lines.join("\n");
  }

  /**
   * Create a complete prompt file content with front matter
   */
  public createPromptFile(metadata: PromptMetadata, content: string): string {
    const frontMatter = this.createFrontMatter(metadata);
    return `${frontMatter}\n\n${content}`;
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
