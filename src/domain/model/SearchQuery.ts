export interface FuzzyOptions {
  maxEdits?: number;
  prefix?: boolean;
  caseSensitive?: boolean;
}

export type SearchScope = "content" | "filename" | "both";

export interface SearchQuery {
  query: string; // raw text
  scope: SearchScope;
  caseSensitive?: boolean; // applies to simple token match
  fuzzy?: FuzzyOptions; // FlexSearch fuzzy options
  maxSuggestions?: number; // for autocomplete
  /**
   * When true, search matches only complete tokens ("whole words").
   * When false (default) prefix matching is allowed.
   */
  matchWholeWord?: boolean;
  isActive: boolean;
}
