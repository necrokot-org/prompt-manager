import { SearchQuery } from "../../domain/model/SearchQuery";

export interface SearchEngine {
  ensureIndexed(
    loader: () => Promise<Array<{ path: string; content: string }>>
  ): Promise<void>;
  search(query: SearchQuery): Array<{
    id: string;
    score: number;
    matches: Record<string, string[]>;
  }>;
  matches(
    file: { path: string; content: string },
    query: SearchQuery
  ): Promise<boolean>;
  upsert(file: { path: string; content: string }): void;
  remove(path: string): void;
  clear(): void;
}
