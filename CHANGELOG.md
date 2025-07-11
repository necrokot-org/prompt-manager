# Change Log

All notable changes to the "prompt-manager" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

### Added

- **BREAKING**: FlexSearch engine replacing MiniSearch for improved performance and native Boolean operators
- Native Boolean query support with +, -, |, AND, OR, NOT operators
- Native case-sensitive search support without post-processing
- Native autocomplete suggestions with configurable limits
- Simplified search API with unified SearchOptions interface

### Deprecated

- MiniSearch engine (replaced by FlexSearch)
- Legacy SearchCriteria scope-based field filtering (replaced by fields array)

### Changed

- **BREAKING**: Migrated from MiniSearch to FlexSearch for better performance and simpler codebase
- **BREAKING**: Search API now uses SearchOptions interface instead of SearchCriteria + files parameters
- **BREAKING**: Removed complex scope-based searching in favor of explicit fields array
- **BREAKING**: Autocomplete now returns SearchResult[] instead of Suggestion[]
- Search indexing now requires explicit index() call before searching
- Improved Boolean query parsing with native FlexSearch operators
- Reduced search engine complexity by removing manual post-processing filters

### Removed

- MiniSearch dependency (replaced by FlexSearch)
- Manual case-sensitive post-filtering logic
- Manual whole-word boundary filtering logic
- Complex multi-index strategy for scope/case combinations
- Legacy SearchCriteria scope enum (titles, content, both)

### Fixed

- Search debouncing now guarantees ≤50ms for suggestion requests

### Technical

- Migrated from MiniSearch to FlexSearch for native Boolean operators and simplified codebase
- Extracted shared parsePrompt utility from search engine to src/utils/parsePrompt.ts
- Replaced MiniSearchEngine with FlexSearchService using simplified two-index strategy
- Updated SearchService to use new FlexSearch API with explicit indexing
- Removed complex scope-to-field mapping and manual post-processing filters
- Updated search result utilities to use new SearchResult interface

- Boolean search transformed from Lucene syntax → Fuse extended search
- New 'Strict' mode checkbox: treats query as raw substring, turning off all operators and fuzziness

- Add dedicated Tags tree with inline clear-filter button and improved active-tag highlight

### Changed

- Environment-aware "Ask AI" button visibility - now only shown in VS Code environment where Chat panel API is available

### Technical

- Updated package.json menu contribution for `promptManager.askAiWithPrompt` with environment-specific `when` clause

- Initial release
