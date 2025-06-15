# Task: Add Search Bar with Filtering

## Description

Add a search bar with dropdown filtering to the VSCode Prompt Manager Extension that allows users to search through prompt titles, content, or both, and dynamically filter the tree view items.

## Complexity

**Level: 3 - Intermediate Feature**  
**Type: Enhanced UI Feature with Filtering Logic**

## Technology Stack

- **Framework**: VSCode Extension API with TreeDataProvider
- **Language**: TypeScript
- **UI Components**: VSCode TreeView with custom filtering
- **Search Engine**: Built-in JavaScript string matching with content parsing
- **State Management**: Extension context and event emitters

## Technology Validation Checkpoints

- [x] Project initialization command verified
- [x] Required dependencies identified and installed
- [x] Build configuration validated
- [x] Hello world verification completed
- [x] Test build passes successfully

## Status

- [x] Initialization complete
- [x] Planning complete
- [ ] Technology validation complete
- [ ] Creative phase (UI/UX Design) complete
- [ ] Core search functionality implementation
- [ ] UI integration implementation
- [ ] Testing and refinement
- [ ] Documentation updates

## Requirements Analysis

### Core Requirements

- [ ] Search input field in the tree view header
- [ ] Dropdown to select search scope: "Titles", "Content", "Both"
- [ ] Real-time filtering of tree items based on search criteria
- [ ] Search through prompt file titles (YAML front matter title field)
- [ ] Search through prompt file content (excluding YAML front matter)
- [ ] Maintain folder structure in filtered results
- [ ] Clear search functionality
- [ ] Preserve tree expand/collapse state during filtering

### Technical Constraints

- [ ] Must integrate with existing PromptTreeProvider
- [ ] Must not break existing tree functionality (copy, open, delete)
- [ ] Must handle YAML front matter parsing for title extraction
- [ ] Must be performant for large prompt collections
- [ ] Must follow VSCode extension UI patterns

## Components Affected

### 1. PromptTreeProvider (`src/promptTreeProvider.ts`)

- **Changes needed**:
  - Add search filtering logic to `getChildren()` and `getRootItems()`
  - Implement search criteria matching
  - Add search state management
- **Dependencies**: PromptManager, FileManager

### 2. Package.json (`package.json`)

- **Changes needed**:
  - Add search bar UI commands
  - Add dropdown selection command
  - Add clear search command
- **Dependencies**: VSCode extension manifest

### 3. Extension.ts (`src/extension.ts`)

- **Changes needed**:
  - Register new search-related commands
  - Initialize search UI components
- **Dependencies**: PromptTreeProvider, CommandHandler

### 4. FileManager (`src/fileManager.ts`)

- **Changes needed**:
  - Add content search functionality
  - Enhance YAML parsing for title extraction
- **Dependencies**: File system operations

## Implementation Strategy

### Phase 1: Core Search Infrastructure

1. [ ] **Add Search State Management**

   - Create SearchCriteria interface
   - Add search state to PromptTreeProvider
   - Implement search state change events

2. [ ] **Enhance File Processing**
   - Add content search methods to FileManager
   - Improve YAML front matter parsing
   - Add text matching utilities

### Phase 2: Tree Filtering Logic

3. [ ] **Implement Tree Filtering**

   - Modify `getChildren()` to respect search filters
   - Add recursive search through folder structures
   - Maintain parent-child relationships in filtered results

4. [ ] **Search Criteria Implementation**
   - Title-only search functionality
   - Content-only search functionality
   - Combined title+content search functionality

### Phase 3: UI Integration

5. [ ] **Add Search UI Commands**

   - Search input command
   - Search scope dropdown command
   - Clear search command

6. [ ] **Integrate with Tree View**
   - Add search bar to tree view header
   - Connect search input to filtering logic
   - Add visual indicators for active search

## Detailed Implementation Steps

### Step 1: Search Infrastructure Setup

- [ ] Create `SearchCriteria` interface with properties:
  - `query: string`
  - `scope: 'titles' | 'content' | 'both'`
  - `caseSensitive: boolean`
- [ ] Add search state properties to `PromptTreeProvider`
- [ ] Implement search state change event emitter

### Step 2: Content Search Enhancement

- [ ] Add `searchInContent()` method to FileManager
- [ ] Add `searchInTitle()` method to FileManager
- [ ] Implement YAML-aware content extraction
- [ ] Add fuzzy/exact matching options

### Step 3: Tree Filtering Implementation

- [ ] Create `applySearchFilter()` method in PromptTreeProvider
- [ ] Modify `getRootItems()` to filter based on search criteria
- [ ] Modify `getFolderItems()` to filter folder contents
- [ ] Ensure filtered results maintain tree structure

### Step 4: UI Command Integration

- [ ] Add search input command to package.json
- [ ] Add dropdown selection command to package.json
- [ ] Register commands in extension.ts
- [ ] Implement command handlers in CommandHandler

### Step 5: Search UI Components

- [ ] Add search bar to tree view title area
- [ ] Implement dropdown for search scope selection
- [ ] Add clear search button
- [ ] Add search result count indicator

## Creative Phases Required

### 🎨 UI/UX Design Phase

- [ ] **Search Bar Layout Design**
  - Determine optimal placement in tree view header
  - Design search input field appearance
  - Plan dropdown integration with VSCode themes
- [ ] **Search Results Presentation**
  - Design filtered tree view appearance
  - Plan search result highlighting
  - Design empty search results state
- [ ] **Search Flow UX**
  - Define search trigger behavior (real-time vs on-enter)
  - Plan search scope switching interaction
  - Design search clearing workflow

### 🏗️ Architecture Design Phase

- [ ] **Search State Management**
  - Design search state persistence strategy
  - Plan search performance optimization
  - Design search event handling architecture

## Dependencies

- **Internal**: PromptManager, FileManager, PromptTreeProvider
- **External**: VSCode TreeView API, Node.js File System
- **UI**: VSCode Command API, ThemeIcon API

## Challenges & Mitigations

### Challenge 1: Performance with Large Prompt Collections

**Mitigation Strategy**:

- Implement debounced search to avoid excessive filtering
- Use memoization for search results
- Add pagination or virtual scrolling if needed

### Challenge 2: YAML Front Matter Parsing Complexity

**Mitigation Strategy**:

- Use existing YAML parsing libraries
- Implement robust error handling for malformed YAML
- Fallback to filename-based title extraction

### Challenge 3: Maintaining Tree State During Filtering

**Mitigation Strategy**:

- Store expanded/collapsed state before filtering
- Restore tree state when search is cleared
- Ensure filtered results preserve logical hierarchy

### Challenge 4: Search Scope UI Integration

**Mitigation Strategy**:

- Use VSCode's native dropdown patterns
- Implement keyboard navigation for dropdown
- Ensure accessibility compliance

## Testing Strategy

### Unit Tests

- [ ] Search criteria matching logic
- [ ] YAML front matter parsing
- [ ] Content search functionality
- [ ] Tree filtering algorithms

### Integration Tests

- [ ] Search UI command integration
- [ ] Tree view filtering behavior
- [ ] Search state persistence
- [ ] Performance with large datasets

### User Experience Tests

- [ ] Search workflow usability
- [ ] Search result accuracy
- [ ] UI responsiveness during search
- [ ] Edge case handling (empty results, special characters)

## Documentation Plan

- [ ] Update README with search functionality
- [ ] Document search scope options
- [ ] Add troubleshooting guide for search issues
- [ ] Update extension description and features list

---

## Current Focus

**Next Phase**: Begin Creative Phase for UI/UX Design

## Blockers

None identified at this time.

---

_Task initialized on 2025-01-27_
