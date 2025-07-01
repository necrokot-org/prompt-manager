export interface SearchCriteria {
  query: string; // raw text
  scope: "titles" | "content" | "both";
  caseSensitive?: boolean; // applies to simple token match
  fuzzy?: boolean; // MiniSearch option
  maxSuggestions?: number; // for autocomplete
  isActive: boolean;
}
