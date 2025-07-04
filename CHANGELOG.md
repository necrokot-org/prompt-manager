# Change Log

All notable changes to the "prompt-manager" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

### Added

- Autocomplete search suggestions with typo-tolerance and ≤50ms debouncing
- Fuzzy search support for typo-tolerant queries
- New MiniSearch engine (≈8 kB min-gzip) replacing Fuse.js + lucene-query-parser
- Field-weighting search with customizable boost values for title, description, tags, and content

### Changed

- **BREAKING**: Removed Lucene boolean syntax; search now uses MiniSearch defaults (space for AND, | for OR, ! for NOT)
- **BREAKING**: Removed exact mode, threshold configuration, and strict mode options
- **BREAKING**: Replaced `exact` and `strict` search options with `fuzzy` option
- Search UI updated with fuzzy search toggle and autocomplete dropdown
- Improved search performance and reduced bundle size

### Removed

- Fuse.js dependency (replaced by MiniSearch)
- lucene-query-parser dependency
- Boolean query support with Lucene syntax
- Threshold and exact match configuration options

### Fixed

- Search debouncing now guarantees ≤50ms for suggestion requests

### Technical

- Migrated from Fuse.js + lucene-query-parser to MiniSearch for search functionality
- Updated SearchCriteria interface with new fuzzy and maxSuggestions properties
- Replaced SearchEngine with MiniSearchEngine class
- Updated all search-related tests to work with new engine
- Added suggestion event handling in extension bus and UI components

- Boolean search transformed from Lucene syntax → Fuse extended search
- New 'Strict' mode checkbox: treats query as raw substring, turning off all operators and fuzziness

- Add dedicated Tags tree with inline clear-filter button and improved active-tag highlight

### Changed

- Environment-aware "Ask AI" button visibility - now only shown in VS Code environment where Chat panel API is available

### Technical

- Updated package.json menu contribution for `promptManager.askAiWithPrompt` with environment-specific `when` clause

- Initial release
