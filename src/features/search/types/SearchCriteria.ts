export interface SearchCriteria {
  query: string; // raw text
  scope: "titles" | "content" | "both";
  caseSensitive?: boolean; // applies to simple token match
  fuzzy?: boolean; // MiniSearch option
  maxSuggestions?: number; // for autocomplete
  /**
   * When true, search matches only complete tokens ("whole words").
   * When false (default) prefix matching is allowed.
   */
  matchWholeWord?: boolean;
  isActive: boolean;
}
