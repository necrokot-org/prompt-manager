import { Index } from "flexsearch";

export enum SearchScope {
  TITLES = "titles",
  CONTENT = "content",
  ALL = "both",
}

export interface SearchOptions {
  query: string;
  scope?: SearchScope | "titles" | "content" | "both";
  caseSensitive?: boolean;
  fuzzy?: boolean | number;
  suggest?: boolean;
  limit?: number;
}

export interface FileContent {
  path: string;
  content: string;
}

export interface SearchResult {
  id: string;
  score: number;
  matches: Record<string, string[]>;
}

export interface ScopeFields {
  [SearchScope.TITLES]: string[];
  [SearchScope.CONTENT]: string[];
  [SearchScope.ALL]: string[];
}

export class FlexSearchService {
  // Case-insensitive indexes
  private titleIndexCI: Index;
  private contentIndexCI: Index;
  private pathIndexCI: Index;

  // Case-sensitive indexes
  private titleIndexCS: Index;
  private contentIndexCS: Index;
  private pathIndexCS: Index;

  private documents: Map<string, FileContent> = new Map();

  constructor() {
    // Create case-insensitive indexes (using default encoder which normalizes case)
    this.titleIndexCI = new Index({
      encode: "default",
      tokenize: "forward",
      resolution: 9,
    });

    this.contentIndexCI = new Index({
      encode: "default",
      tokenize: "forward",
      resolution: 9,
    });

    this.pathIndexCI = new Index({
      encode: "default",
      tokenize: "forward",
      resolution: 9,
    });

    // Create case-sensitive indexes (identity encoder)
    this.titleIndexCS = new Index({
      encode: (str: string) => [str],
      tokenize: "forward",
      resolution: 9,
    });

    this.contentIndexCS = new Index({
      encode: (str: string) => [str],
      tokenize: "forward",
      resolution: 9,
    });

    this.pathIndexCS = new Index({
      encode: (str: string) => [str],
      tokenize: "forward",
      resolution: 9,
    });
  }

  async indexFiles(files: FileContent[]): Promise<void> {
    // Clear existing indexes
    this.clearCache();

    // Index all files in both case-insensitive and case-sensitive indexes
    for (const file of files) {
      this.documents.set(file.path, file);

      const title = this.extractTitle(file.content);

      await Promise.all([
        // Case-insensitive indexes
        this.titleIndexCI.add(file.path, title),
        this.contentIndexCI.add(file.path, file.content),
        this.pathIndexCI.add(file.path, file.path),
        // Case-sensitive indexes
        this.titleIndexCS.add(file.path, title),
        this.contentIndexCS.add(file.path, file.content),
        this.pathIndexCS.add(file.path, file.path),
      ]);
    }
  }

  search(options: SearchOptions): SearchResult[] {
    const query = options.query.trim();
    if (!query) {
      return [];
    }

    // Determine which indexes to search based on scope and case sensitivity
    const scope = options.scope || SearchScope.ALL;
    const isCaseSensitive = options.caseSensitive === true;
    const indexesToSearch: Array<{ index: Index; field: string }> = [];

    switch (scope) {
      case SearchScope.TITLES:
        indexesToSearch.push({
          index: isCaseSensitive ? this.titleIndexCS : this.titleIndexCI,
          field: "title",
        });
        indexesToSearch.push({
          index: isCaseSensitive ? this.pathIndexCS : this.pathIndexCI,
          field: "path",
        });
        break;
      case SearchScope.CONTENT:
        indexesToSearch.push({
          index: isCaseSensitive ? this.contentIndexCS : this.contentIndexCI,
          field: "content",
        });
        break;
      case SearchScope.ALL:
      default:
        indexesToSearch.push({
          index: isCaseSensitive ? this.titleIndexCS : this.titleIndexCI,
          field: "title",
        });
        indexesToSearch.push({
          index: isCaseSensitive ? this.contentIndexCS : this.contentIndexCI,
          field: "content",
        });
        indexesToSearch.push({
          index: isCaseSensitive ? this.pathIndexCS : this.pathIndexCI,
          field: "path",
        });
        break;
    }

    // Search each index and combine results
    const allResults = new Map<string, SearchResult>();

    for (const { index, field } of indexesToSearch) {
      const searchOptions: any = {
        query,
        limit: options.limit || 100,
        suggest: options.suggest || false,
      };

      // Handle fuzzy search - now boolean | number
      if (options.fuzzy) {
        searchOptions.fuzzy =
          typeof options.fuzzy === "number" ? options.fuzzy : 1;
      }

      const fieldResults = index.search(searchOptions);

      // Process results for this field
      if (Array.isArray(fieldResults)) {
        for (const result of fieldResults) {
          if (typeof result === "string") {
            // Simple result - just the ID
            const existing = allResults.get(result) || {
              id: result,
              score: 1,
              matches: {},
            };
            existing.matches[field] = existing.matches[field] || [];
            allResults.set(result, existing);
          } else if (typeof result === "object" && result !== null) {
            // Complex result with score
            const docId =
              (result as any)?.id || (result as any)?.toString() || "";
            const existing = allResults.get(docId) || {
              id: docId,
              score: 0,
              matches: {},
            };
            existing.score = Math.max(
              existing.score,
              (result as any).score || 1
            );
            (existing.matches as any)[field] = (result as any).matches || [];
            allResults.set(docId, existing);
          }
        }
      }
    }

    // Convert to array and sort by score
    return Array.from(allResults.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, options.limit || 100);
  }

  async upsertDocument(file: FileContent): Promise<void> {
    this.documents.set(file.path, file);

    const title = this.extractTitle(file.content);

    await Promise.all([
      // Case-insensitive indexes
      this.titleIndexCI.update(file.path, title),
      this.contentIndexCI.update(file.path, file.content),
      this.pathIndexCI.update(file.path, file.path),
      // Case-sensitive indexes
      this.titleIndexCS.update(file.path, title),
      this.contentIndexCS.update(file.path, file.content),
      this.pathIndexCS.update(file.path, file.path),
    ]);
  }

  async removeDocument(path: string): Promise<void> {
    this.documents.delete(path);
    await Promise.all([
      // Case-insensitive indexes
      this.titleIndexCI.remove(path),
      this.contentIndexCI.remove(path),
      this.pathIndexCI.remove(path),
      // Case-sensitive indexes
      this.titleIndexCS.remove(path),
      this.contentIndexCS.remove(path),
      this.pathIndexCS.remove(path),
    ]);
  }

  clearCache(): void {
    // Clear the indexes by recreating them

    // Case-insensitive indexes
    this.titleIndexCI = new Index({
      encode: "default",
      tokenize: "forward",
      resolution: 9,
    });

    this.contentIndexCI = new Index({
      encode: "default",
      tokenize: "forward",
      resolution: 9,
    });

    this.pathIndexCI = new Index({
      encode: "default",
      tokenize: "forward",
      resolution: 9,
    });

    // Case-sensitive indexes
    this.titleIndexCS = new Index({
      encode: (str: string) => [str],
      tokenize: "forward",
      resolution: 9,
    });

    this.contentIndexCS = new Index({
      encode: (str: string) => [str],
      tokenize: "forward",
      resolution: 9,
    });

    this.pathIndexCS = new Index({
      encode: (str: string) => [str],
      tokenize: "forward",
      resolution: 9,
    });

    this.documents.clear();
  }

  private extractTitle(content: string): string {
    // Extract title from frontmatter or first heading
    const lines = content.split("\n");
    let title = "";

    // Check for frontmatter title
    if (lines[0].trim() === "---") {
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === "---") {
          break;
        }
        if (line.startsWith("title:")) {
          title = line.substring(6).trim();
          if (title.startsWith('"') && title.endsWith('"')) {
            title = title.slice(1, -1);
          }
          break;
        }
      }
    }

    // If no frontmatter title, look for first heading
    if (!title) {
      for (const line of lines) {
        if (line.startsWith("# ")) {
          title = line.substring(2).trim();
          break;
        }
      }
    }

    return title || "Untitled";
  }
}
