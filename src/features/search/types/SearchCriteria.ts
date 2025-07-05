import { SearchScope, FuzzyOptions } from "../core/FlexSearchService";

export interface SearchCriteria {
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
