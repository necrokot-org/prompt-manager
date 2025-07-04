import * as vscode from "vscode";
import { injectable, inject } from "tsyringe";
import { eventBus } from "@infra/vscode/ExtensionBus";
import { DI_TOKENS } from "@infra/di/di-tokens";
import { SearchCriteria } from "@features/search/types/SearchCriteria";

@injectable()
export class SearchPanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "promptManagerSearch";

  private _view?: vscode.WebviewView;
  private _criteria: SearchCriteria = {
    query: "",
    scope: "both",
    caseSensitive: false,
    fuzzy: false,
    matchWholeWord: false,
    isActive: false,
  };

  constructor(
    @inject(DI_TOKENS.ExtensionContext)
    private readonly _context: vscode.ExtensionContext
  ) {
    // Get extension URI from context
    this._extensionUri = _context.extensionUri;
  }

  private readonly _extensionUri: vscode.Uri;

  /**
   * Normalizes search criteria with proper defaults
   */
  private normalizeSearchCriteria<
    T extends { includeSuggestions?: boolean; computeIsActive?: boolean }
  >(criteria: Partial<SearchCriteria> = {}, options: T = {} as T) {
    const query = criteria.query || "";
    const scope = criteria.scope || ("both" as const);
    const caseSensitive = criteria.caseSensitive ?? false;
    const fuzzy = criteria.fuzzy ?? false;
    const matchWholeWord = criteria.matchWholeWord ?? false;

    let isActive = criteria.isActive ?? false;
    if (options.computeIsActive) {
      isActive = query.trim().length > 0;
    }

    const normalized = {
      query,
      scope,
      caseSensitive,
      fuzzy,
      matchWholeWord,
      isActive,
    };

    if (options.includeSuggestions) {
      return {
        ...normalized,
        maxSuggestions: criteria.maxSuggestions ?? 5,
      };
    }

    return normalized;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      // Allow scripts in the webview
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(
      (data) => {
        switch (data.type) {
          case "search":
            this.handleSearch(data.criteria);
            break;
          case "suggest":
            this.handleSuggestionRequest(data.criteria);
            break;
          case "clear":
            this.handleClear();
            break;
        }
      },
      undefined,
      []
    );
  }

  private handleSearch(criteria: Omit<SearchCriteria, "isActive">): void {
    const normalizedCriteria = this.normalizeSearchCriteria(criteria, {
      computeIsActive: true,
    });

    this._criteria = normalizedCriteria;

    // Publish search criteria changed event with normalized data
    eventBus.emit("search.criteria.changed", {
      query: normalizedCriteria.query,
      scope: normalizedCriteria.scope,
      caseSensitive: normalizedCriteria.caseSensitive ?? false,
      fuzzy: normalizedCriteria.fuzzy ?? false,
      matchWholeWord: normalizedCriteria.matchWholeWord ?? false,
      isActive: normalizedCriteria.isActive,
    });
  }

  private handleSuggestionRequest(
    criteria: Omit<SearchCriteria, "isActive">
  ): void {
    const normalizedCriteria = this.normalizeSearchCriteria(criteria, {
      includeSuggestions: true,
    });

    // Publish suggestion request event
    eventBus.emit("search.suggest.requested", normalizedCriteria);
  }

  private handleClear(): void {
    this._criteria = this.normalizeSearchCriteria();

    // Emit search cleared event
    eventBus.emit("search.cleared", {});

    // Update the webview
    if (this._view) {
      this._view.webview.postMessage({
        type: "clearSearchInput",
      });
    }
  }

  public updateResultCount(count: number): void {
    if (this._view) {
      this._view.webview.postMessage({
        type: "updateResultCount",
        count: count,
      });
    }
  }

  public updateSuggestions(suggestions: any[]): void {
    if (this._view) {
      this._view.webview.postMessage({
        type: "suggestions",
        items: suggestions,
      });
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    // Resolve Codicon stylesheet URI (fallback to CDN if local not found)
    const codiconUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionUri,
        "node_modules",
        "@vscode/codicons",
        "dist",
        "codicon.css"
      )
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Prompt Search</title>
    <link rel="stylesheet" href="${codiconUri}">
    <style>
        body {
            padding: 8px;
            margin: 0;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            background-color: var(--vscode-sideBar-background);
            color: var(--vscode-sideBar-foreground);
        }

        .search-container {
            display: flex;
            flex-direction: column;
            gap: 8px;
            border-bottom: 1px solid var(--vscode-sideBar-border);
            padding-bottom: 8px;
            margin-bottom: 8px;
            position: relative;
        }

        .search-input-row {
            display: flex;
            gap: 4px;
            align-items: center;
            position: relative;
        }

        .search-input {
            flex: 1;
            padding: 4px 8px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-size: var(--vscode-font-size);
            border-radius: 2px;
        }

        .search-input:focus {
            outline: 1px solid var(--vscode-focusBorder);
            border-color: var(--vscode-focusBorder);
        }

        .search-input::placeholder {
            color: var(--vscode-input-placeholderForeground);
        }

        .clear-button {
            padding: 2px 6px;
            border: 1px solid var(--vscode-button-border);
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border-radius: 2px;
            cursor: pointer;
            font-size: 11px;
            min-width: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .clear-button:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }

        .suggestions-dropdown {
            position: absolute;
            top: 100%;
            left: 0;
            right: 24px;
            background-color: var(--vscode-dropdown-background);
            border: 1px solid var(--vscode-dropdown-border);
            border-radius: 2px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
            z-index: 1000;
            max-height: 200px;
            overflow-y: auto;
            display: none;
        }

        .suggestion-item {
            padding: 4px 8px;
            cursor: pointer;
            border-bottom: 1px solid var(--vscode-sideBar-border);
            font-size: 11px;
        }

        .suggestion-item:last-child {
            border-bottom: none;
        }

        .suggestion-item:hover {
            background-color: var(--vscode-list-hoverBackground);
        }

        .suggestion-item.selected {
            background-color: var(--vscode-list-activeSelectionBackground);
            color: var(--vscode-list-activeSelectionForeground);
        }

        .search-options {
            display: flex;
            gap: 8px;
            align-items: center;
            font-size: 12px;
        }

        .scope-select {
            padding: 2px 4px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
            font-size: 11px;
            border-radius: 2px;
        }

        .scope-select:focus {
            outline: 1px solid var(--vscode-focusBorder);
            border-color: var(--vscode-focusBorder);
        }

        .checkbox-container {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .checkbox-icon {
            cursor: pointer;
            opacity: 0.4;
            transition: opacity 0.2s ease;
            padding: 2px;
            border-radius: 2px;
            position: relative;
            display: inline-block;
        }

        .checkbox-icon:hover {
            opacity: 0.7;
            background-color: var(--vscode-toolbar-hoverBackground);
        }

        .checkbox-icon.checked {
            opacity: 1;
            color: var(--vscode-foreground);
        }

        .checkbox-icon.checked::after {
            content: '';
            position: absolute;
            bottom: -2px;
            left: 50%;
            transform: translateX(-50%);
            width: 12px;
            height: 2px;
            background-color: var(--vscode-focusBorder);
            border-radius: 1px;
        }

        .result-info {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            text-align: center;
            padding: 2px 0;
        }

        .no-results {
            color: var(--vscode-editorWarning-foreground);
        }

        .hidden {
            display: none;
        }
    </style>
</head>
<body>
    <div class="search-container">
        <div class="search-input-row">
            <input 
                type="text" 
                id="searchInput" 
                class="search-input" 
                placeholder="Search prompts..."
                spellcheck="false"
                autocomplete="off"
            >
            <ul id="suggestBox" class="suggestions-dropdown"></ul>
            <button id="clearButton" class="clear-button" title="Clear search">×</button>
        </div>
        
        <div class="search-options">
            <select id="scopeSelect" class="scope-select" title="Search scope">
                <option value="both">All</option>
                <option value="titles">Titles</option>
                <option value="content">Content</option>
            </select>
            
            <div class="checkbox-container">
                <span id="caseSensitive" class="checkbox-icon codicon codicon-case-sensitive" title="Case sensitive"></span>
            </div>
            
            <div class="checkbox-container">
                <span id="fuzzySearch" class="checkbox-icon codicon codicon-search-fuzzy" title="Fuzzy search"></span>
            </div>

            <div class="checkbox-container">
                <span id="wholeWord" class="checkbox-icon codicon codicon-whole-word" title="Match whole word"></span>
            </div>
        </div>
    </div>
    
    <div id="resultInfo" class="result-info hidden">
        <span id="resultCount">0</span> results
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        const searchInput = document.getElementById('searchInput');
        const clearButton = document.getElementById('clearButton');
        const scopeSelect = document.getElementById('scopeSelect');
        const caseSensitive = document.getElementById('caseSensitive');
        const fuzzySearch = document.getElementById('fuzzySearch');
        const wholeWord = document.getElementById('wholeWord');
        const resultInfo = document.getElementById('resultInfo');
        const resultCount = document.getElementById('resultCount');
        const suggestBox = document.getElementById('suggestBox');

        const DEBOUNCE_MS = 50; // ≤ 50 ms as required
        let searchDebounceTimer;
        let suggestDebounceTimer;
        let currentSuggestions = [];
        let selectedSuggestionIndex = -1;

        function debounce(func, wait) {
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(searchDebounceTimer);
                    func(...args);
                };
                clearTimeout(searchDebounceTimer);
                searchDebounceTimer = setTimeout(later, wait);
            };
        }

        function buildCriteria() {
            return {
                query: searchInput.value.trim(),
                scope: scopeSelect.value,
                caseSensitive: caseSensitive.classList.contains('checked'),
                fuzzy: fuzzySearch.classList.contains('checked'),
                matchWholeWord: wholeWord.classList.contains('checked'),
                maxSuggestions: 5
            };
        }

        function postSearch() {
            const criteria = buildCriteria();
            vscode.postMessage({
                type: 'search',
                criteria: criteria
            });

            // Show/hide result info
            if (criteria.query.length > 0) {
                resultInfo.classList.remove('hidden');
            } else {
                resultInfo.classList.add('hidden');
            }
        }

        function postSuggestionRequest() {
            const criteria = buildCriteria();
            if (criteria.query.length > 0) {
                vscode.postMessage({
                    type: 'suggest',
                    criteria: criteria
                });
            } else {
                hideSuggestions();
            }
        }

        const debouncedSearch = debounce(postSearch, 80);

        function onInput() {
            debouncedSearch();
            
            // Clear previous suggestion timer
            clearTimeout(suggestDebounceTimer);
            
            // Request suggestions with minimal debounce
            suggestDebounceTimer = setTimeout(postSuggestionRequest, DEBOUNCE_MS);
        }

        function renderSuggestions(suggestions) {
            currentSuggestions = suggestions;
            selectedSuggestionIndex = -1;
            
            if (suggestions.length === 0) {
                hideSuggestions();
                return;
            }

            suggestBox.innerHTML = '';
            suggestions.forEach((suggestion, index) => {
                const li = document.createElement('li');
                li.className = 'suggestion-item';
                li.textContent = suggestion.suggestion || suggestion.term || suggestion;
                li.onclick = () => selectSuggestion(suggestion);
                suggestBox.appendChild(li);
            });

            suggestBox.style.display = 'block';
        }

        function hideSuggestions() {
            suggestBox.style.display = 'none';
            currentSuggestions = [];
            selectedSuggestionIndex = -1;
        }

        function selectSuggestion(suggestion) {
            const suggestionText = suggestion.suggestion || suggestion.term || suggestion;
            searchInput.value = suggestionText;
            hideSuggestions();
            postSearch(); // Trigger search with selected suggestion
        }

        function handleKeyboard(e) {
            if (suggestBox.style.display === 'none' || currentSuggestions.length === 0) {
                return;
            }

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    selectedSuggestionIndex = Math.min(selectedSuggestionIndex + 1, currentSuggestions.length - 1);
                    updateSuggestionSelection();
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    selectedSuggestionIndex = Math.max(selectedSuggestionIndex - 1, -1);
                    updateSuggestionSelection();
                    break;
                case 'Enter':
                    if (selectedSuggestionIndex >= 0) {
                        e.preventDefault();
                        selectSuggestion(currentSuggestions[selectedSuggestionIndex]);
                    }
                    break;
                case 'Escape':
                    hideSuggestions();
                    break;
            }
        }

        function updateSuggestionSelection() {
            const items = suggestBox.querySelectorAll('.suggestion-item');
            items.forEach((item, index) => {
                if (index === selectedSuggestionIndex) {
                    item.classList.add('selected');
                } else {
                    item.classList.remove('selected');
                }
            });
        }

        function toggleCheckbox(element) {
            if (element.classList.contains('checked')) {
                element.classList.remove('checked');
            } else {
                element.classList.add('checked');
            }
            debouncedSearch();
        }

        // Event listeners
        searchInput.addEventListener('input', onInput);
        searchInput.addEventListener('keydown', handleKeyboard);
        searchInput.addEventListener('blur', () => {
            // Hide suggestions with a delay to allow click selection
            setTimeout(hideSuggestions, 150);
        });
        
        scopeSelect.addEventListener('change', debouncedSearch);
        caseSensitive.addEventListener('click', () => toggleCheckbox(caseSensitive));
        fuzzySearch.addEventListener('click', () => toggleCheckbox(fuzzySearch));
        wholeWord.addEventListener('click', () => toggleCheckbox(wholeWord));

        clearButton.addEventListener('click', () => {
            searchInput.value = '';
            scopeSelect.value = 'both';
            caseSensitive.classList.remove('checked');
            fuzzySearch.classList.remove('checked');
            wholeWord.classList.remove('checked');
            resultInfo.classList.add('hidden');
            hideSuggestions();
            
            vscode.postMessage({
                type: 'clear'
            });
        });

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.type) {
                case 'clearSearchInput':
                    searchInput.value = '';
                    scopeSelect.value = 'both';
                    caseSensitive.classList.remove('checked');
                    fuzzySearch.classList.remove('checked');
                    wholeWord.classList.remove('checked');
                    resultInfo.classList.add('hidden');
                    hideSuggestions();
                    break;
                case 'updateResultCount':
                    resultCount.textContent = message.count;
                    if (searchInput.value.trim().length > 0) {
                        resultInfo.classList.remove('hidden');
                        if (message.count === 0) {
                            resultInfo.classList.add('no-results');
                        } else {
                            resultInfo.classList.remove('no-results');
                        }
                    }
                    break;
                case 'suggestions':
                    renderSuggestions(message.items);
                    break;
            }
        });

        // Focus search input when webview becomes visible
        searchInput.focus();
    </script>
</body>
</html>`;
  }
}
