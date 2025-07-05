export interface SearchSuggestion {
  /** Text to display in dropdown and insert into query when selected */
  suggestion: string;
  /** Original term (optional – kept for future flexsearch metadata) */
  term?: string;
}
