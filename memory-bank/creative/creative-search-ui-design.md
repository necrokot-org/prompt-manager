# 🎨🎨🎨 ENTERING CREATIVE PHASE: UI/UX DESIGN 🎨🎨🎨

## Component: SearchPanelProvider Webview Interface

### Problem Statement

Design an always-visible inline search box that integrates seamlessly with VSCode's tree view panel while providing real-time dynamic filtering capabilities. The search interface must feel native to VSCode, remain persistently visible, and provide clear visual feedback for search operations without disrupting the existing prompt management workflow.

### Requirements & Constraints

**Functional Requirements:**

- Always-visible search input (not hidden behind a button)
- Real-time filtering with debounced input (300ms delay)
- Scope selector dropdown (Titles, Content, Both)
- Clear/reset search functionality
- Search result count display
- Visual indicators for active search state

**Technical Constraints:**

- Must integrate with VSCode Webview API
- Must fit within existing tree view panel layout
- Must follow VSCode theming and design patterns
- Must handle responsive design within panel constraints
- Must maintain accessibility standards
- Performance requirements for 100+ prompt files

**Visual Constraints:**

- Must match VSCode native styling
- Must adapt to light/dark themes automatically
- Must not interfere with tree view scrolling
- Must provide clear visual hierarchy

### 🎨 CREATIVE CHECKPOINT: Requirements Analysis Complete

## Multiple UI/UX Options Analysis

### Option 1: Integrated Header Bar Design

**Description**: Search box positioned as a fixed header at the top of the tree view panel, similar to VSCode's file explorer search.

**Visual Layout:**

```
┌─────────────────────────────────────┐
│ 🔍 [Search prompts...] [▼ Scope] [×]│ <- Always visible header
├─────────────────────────────────────┤
│ 📁 Folder 1                        │
│   📄 Prompt 1.md                   │
│   📄 Prompt 2.md                   │
│ 📁 Folder 2                        │
│   📄 Prompt 3.md                   │
└─────────────────────────────────────┘
```

**Pros:**

- Familiar VSCode pattern (matches file explorer)
- Always visible without taking tree space
- Clean separation of search and content areas
- Easy to implement with webview positioning
- Natural tab order for accessibility

**Cons:**

- Reduces vertical space for tree content
- Fixed positioning may conflict with panel resizing
- Requires careful z-index management
- May feel cramped in narrow panels

**Complexity**: Medium
**Implementation Time**: 2-3 hours
**VSCode Pattern Alignment**: High

### Option 2: Collapsible Inline Row Design

**Description**: Search functionality integrated as a collapsible row within the tree structure, expandable but defaulting to a compact state.

**Visual Layout (Collapsed):**

```
┌─────────────────────────────────────┐
│ ▶ 🔍 Search prompts... (3 results)  │ <- Expandable search row
│ 📁 Folder 1                        │
│   📄 Prompt 1.md                   │
│   📄 Prompt 2.md                   │
└─────────────────────────────────────┘
```

**Visual Layout (Expanded):**

```
┌─────────────────────────────────────┐
│ ▼ 🔍 Search prompts...              │
│   Scope: [Titles ▼] Results: 3     │
│   [Clear Search]                    │
│ 📁 Folder 1                        │
│   📄 Prompt 1.md ⭐                │
│   📄 Prompt 2.md ⭐                │
└─────────────────────────────────────┘
```

**Pros:**

- Saves space when not actively searching
- Integrates naturally with tree structure
- Provides detailed controls when expanded
- Maintains context with filtered results
- Progressive disclosure of features

**Cons:**

- Not "always visible" as specified in requirements
- More complex state management
- May confuse users expecting persistent search
- Requires additional expand/collapse logic

**Complexity**: High
**Implementation Time**: 4-5 hours
**VSCode Pattern Alignment**: Medium

### Option 3: Floating Toolbar Design

**Description**: Persistent floating toolbar that appears above tree content, can be moved or minimized by user.

**Visual Layout:**

```
┌─────────────────────────────────────┐
│ ┌─ Search Toolbar ─────────────── ×│
│ │🔍[Search...][Scope▼][Clear] 12  ││ <- Floating, moveable
│ └─────────────────────────────────┘│
│ 📁 Folder 1                        │
│   📄 Prompt 1.md                   │
│   📄 Prompt 2.md                   │
└─────────────────────────────────────┘
```

**Pros:**

- User-controlled positioning
- Always visible but flexible
- Rich feature set with clear labeling
- Can be minimized when not needed
- Doesn't interfere with tree structure

**Cons:**

- Unfamiliar pattern in VSCode context
- Complex interaction model
- May obscure tree content
- Difficult to implement in webview
- Accessibility challenges with floating elements

**Complexity**: Very High
**Implementation Time**: 6-8 hours
**VSCode Pattern Alignment**: Low

### Option 4: Embedded Panel Design

**Description**: Search interface embedded as a dedicated section within the panel, always visible with subtle visual separation.

**Visual Layout:**

```
┌─────────────────────────────────────┐
│ ┌── Search & Filter ──────────────┐ │
│ │🔍 [Search prompts...] [Clear]   │ │ <- Always visible section
│ │   Scope: [Both ▼]   Results: 12 │ │
│ └─────────────────────────────────┘ │
│                                     │
│ 📁 Folder 1                        │
│   📄 Prompt 1.md                   │
│   📄 Prompt 2.md                   │
└─────────────────────────────────────┘
```

**Pros:**

- Always visible as required
- Clear visual separation from tree content
- Accommodates all search features
- Familiar panel-based layout
- Room for future enhancements
- Easy to make accessible

**Cons:**

- Takes up vertical space permanently
- May feel heavy for simple searches
- Requires more complex CSS layout
- Fixed space allocation

**Complexity**: Medium-High
**Implementation Time**: 3-4 hours
**VSCode Pattern Alignment**: Medium-High

## 🎨 CREATIVE CHECKPOINT: Options Generated

### Recommended Approach: Option 1 - Integrated Header Bar Design

**Selection Rationale:**

1. **Requirements Alignment**: Perfectly matches the "always-visible" requirement
2. **VSCode Consistency**: Follows established VSCode patterns (file explorer search)
3. **User Familiarity**: Users already understand this pattern from other VSCode panels
4. **Implementation Feasibility**: Straightforward webview implementation
5. **Performance**: Minimal impact on tree rendering performance
6. **Accessibility**: Natural tab order and screen reader compatibility

**Key Design Decisions:**

- **Search Input**: Full-width input with search icon and placeholder text
- **Scope Dropdown**: Compact dropdown aligned to the right of input
- **Clear Button**: X button that appears when search is active
- **Visual Feedback**: Subtle border color change when search is active
- **Result Counter**: Small text indicator showing "X results" when filtering

## Implementation Guidelines

### HTML Structure

```html
<div class="search-header">
  <div class="search-input-container">
    <vscode-text-field
      placeholder="Search prompts..."
      id="searchInput"
      class="search-input"
    >
      <span slot="start" class="search-icon">🔍</span>
    </vscode-text-field>

    <vscode-dropdown id="scopeSelector" class="scope-dropdown">
      <vscode-option value="both">Both</vscode-option>
      <vscode-option value="titles">Titles</vscode-option>
      <vscode-option value="content">Content</vscode-option>
    </vscode-dropdown>

    <vscode-button
      id="clearButton"
      appearance="icon"
      class="clear-button hidden"
    >
      ×
    </vscode-button>
  </div>

  <div class="search-status" id="searchStatus">
    <span class="result-count hidden" id="resultCount"></span>
  </div>
</div>
```

### CSS Styling (VSCode Theming)

```css
.search-header {
  position: sticky;
  top: 0;
  background: var(--vscode-sideBar-background);
  border-bottom: 1px solid var(--vscode-sideBar-border);
  padding: 8px;
  z-index: 100;
}

.search-input-container {
  display: flex;
  gap: 6px;
  align-items: center;
}

.search-input {
  flex: 1;
  min-width: 0;
}

.scope-dropdown {
  min-width: 80px;
}

.clear-button {
  opacity: 0.7;
  transition: opacity 0.2s;
}

.clear-button:hover {
  opacity: 1;
}

.search-status {
  margin-top: 4px;
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
}

.result-count {
  font-weight: 500;
}

.hidden {
  display: none;
}

/* Active search state */
.search-header.active .search-input {
  border-color: var(--vscode-focusBorder);
}

.search-header.active .clear-button {
  display: block;
}

.search-header.active .result-count {
  display: inline;
}
```

### JavaScript Interaction Logic

```javascript
// Debounced search implementation
let searchTimeout;
const SEARCH_DELAY = 300;

function setupSearchInterface() {
  const searchInput = document.getElementById("searchInput");
  const scopeSelector = document.getElementById("scopeSelector");
  const clearButton = document.getElementById("clearButton");
  const searchStatus = document.getElementById("searchStatus");
  const resultCount = document.getElementById("resultCount");

  searchInput.addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      performSearch(e.target.value, scopeSelector.value);
    }, SEARCH_DELAY);
  });

  scopeSelector.addEventListener("change", (e) => {
    if (searchInput.value) {
      performSearch(searchInput.value, e.target.value);
    }
  });

  clearButton.addEventListener("click", () => {
    clearSearch();
  });
}

function performSearch(query, scope) {
  const header = document.querySelector(".search-header");

  if (query.trim()) {
    header.classList.add("active");
    // Send search request to extension
    vscode.postMessage({
      command: "search",
      query: query,
      scope: scope,
    });
  } else {
    clearSearch();
  }
}

function clearSearch() {
  const searchInput = document.getElementById("searchInput");
  const header = document.querySelector(".search-header");

  searchInput.value = "";
  header.classList.remove("active");

  vscode.postMessage({
    command: "clearSearch",
  });
}

function updateResultCount(count) {
  const resultCount = document.getElementById("resultCount");
  resultCount.textContent = `${count} result${count !== 1 ? "s" : ""}`;
}
```

### Accessibility Considerations

- Proper ARIA labels for search input and dropdown
- Keyboard navigation support (Tab, Enter, Escape)
- Screen reader announcements for search results
- High contrast mode compatibility
- Focus management during search operations

## Verification Against Requirements

**✓ Always-visible search input**: Header bar design ensures permanent visibility
**✓ Real-time filtering with debouncing**: 300ms delay implemented
**✓ Scope selector dropdown**: Integrated dropdown with clear options
**✓ Clear/reset functionality**: Dedicated clear button with intuitive placement
**✓ Search result count display**: Status area shows result count
**✓ Visual search state indicators**: Active state styling and button visibility
**✓ VSCode theming compatibility**: Uses VSCode CSS variables throughout
**✓ Responsive design**: Flexible layout adapts to panel width
**✓ Accessibility compliance**: ARIA labels, keyboard navigation, screen reader support

🎨🎨🎨 EXITING CREATIVE PHASE: UI/UX DESIGN COMPLETE 🎨🎨🎨
