import * as vscode from "vscode";
import { injectable, inject } from "tsyringe";
import { eventBus } from "./core/ExtensionBus";
import { DI_TOKENS } from "./core/di-tokens";

export interface SearchCriteria {
  query: string;
  scope: "titles" | "content" | "both";
  caseSensitive: boolean;
  isActive: boolean;
}

@injectable()
export class SearchPanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "promptManagerSearch";

  private _view?: vscode.WebviewView;
  private _criteria: SearchCriteria = {
    query: "",
    scope: "both",
    caseSensitive: false,
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
    // Determine active state based on presence of non-whitespace characters in the query
    const isActive = (criteria.query || "").trim().length > 0;

    // Merge incoming criteria with the computed isActive flag
    const normalizedCriteria: SearchCriteria = {
      ...criteria,
      isActive,
    } as SearchCriteria;

    this._criteria = normalizedCriteria;

    // Publish search criteria changed event with normalized data
    eventBus.emit("search.criteria.changed", {
      query: normalizedCriteria.query,
      scope: normalizedCriteria.scope,
      caseSensitive: normalizedCriteria.caseSensitive,
      isActive: normalizedCriteria.isActive,
    });
  }

  private handleClear(): void {
    this._criteria = {
      query: "",
      scope: "both",
      caseSensitive: false,
      isActive: false,
    };

    // Emit search cleared event
    eventBus.emit("search.cleared", {});

    // Update the webview
    if (this._view) {
      this._view.webview.postMessage({
        type: "clearSearchInput",
      });
    }
  }

  public getCurrentSearchCriteria(): SearchCriteria {
    return { ...this._criteria };
  }

  public updateResultCount(count: number): void {
    if (this._view) {
      this._view.webview.postMessage({
        type: "updateResultCount",
        count: count,
      });
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Prompt Search</title>
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
        }

        .search-input-row {
            display: flex;
            gap: 4px;
            align-items: center;
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
            gap: 4px;
        }

        .checkbox {
            margin: 0;
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
            >
            <button id="clearButton" class="clear-button" title="Clear search">×</button>
        </div>
        
        <div class="search-options">
            <select id="scopeSelect" class="scope-select" title="Search scope">
                <option value="both">All</option>
                <option value="titles">Titles</option>
                <option value="content">Content</option>
            </select>
            
            <div class="checkbox-container">
                <input type="checkbox" id="caseSensitive" class="checkbox">
                <label for="caseSensitive">Aa</label>
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
        const resultInfo = document.getElementById('resultInfo');
        const resultCount = document.getElementById('resultCount');

        let debounceTimer;

        function debounce(func, wait) {
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(debounceTimer);
                    func(...args);
                };
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(later, wait);
            };
        }

        const debouncedSearch = debounce(() => {
            const query = searchInput.value.trim();
            const scope = scopeSelect.value;
            const isCaseSensitive = caseSensitive.checked;

            vscode.postMessage({
                type: 'search',
                criteria: {
                    query: query,
                    scope: scope,
                    caseSensitive: isCaseSensitive
                }
            });

            // Show/hide result info
            if (query.length > 0) {
                resultInfo.classList.remove('hidden');
            } else {
                resultInfo.classList.add('hidden');
            }
        }, 300);

        // Event listeners
        searchInput.addEventListener('input', debouncedSearch);
        scopeSelect.addEventListener('change', debouncedSearch);
        caseSensitive.addEventListener('change', debouncedSearch);

        clearButton.addEventListener('click', () => {
            searchInput.value = '';
            scopeSelect.value = 'both';
            caseSensitive.checked = false;
            resultInfo.classList.add('hidden');
            
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
                    caseSensitive.checked = false;
                    resultInfo.classList.add('hidden');
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
            }
        });

        // Focus search input when webview becomes visible
        searchInput.focus();
    </script>
</body>
</html>`;
  }
}
