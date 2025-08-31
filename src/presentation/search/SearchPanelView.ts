import * as vscode from "vscode";
import * as path from "path";
import { SearchApp } from "../../application/SearchApp";
import { SearchQuery } from "../../domain/model/SearchQuery";

/**
 * Simplified search panel view using the new SearchApp
 */
export class SearchPanelView implements vscode.WebviewViewProvider {
  public static readonly viewType = "promptManagerSearch";
  private _view?: vscode.WebviewView;

  constructor(private searchApp: SearchApp, private extensionUri: vscode.Uri) {
    // Listen to search app events
    this.searchApp.onResultsCountChanged((count) => {
      this.updateResultCount(count);
    });
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext<unknown>,
    token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, "dist"),
        vscode.Uri.joinPath(this.extensionUri, "assets"),
      ],
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case "search":
          await this.handleSearch(data.criteria);
          break;
        case "clear":
          this.handleClear();
          break;
      }
    });
  }

  private async handleSearch(criteria: any): Promise<void> {
    try {
      const queryText = (criteria.query || "").trim();
      const searchQuery: SearchQuery = {
        query: queryText,
        scope: criteria.scope || "both",
        caseSensitive: criteria.caseSensitive || false,
        fuzzy: criteria.fuzzy,
        maxSuggestions: criteria.maxSuggestions,
        matchWholeWord: criteria.matchWholeWord || false,
        isActive: queryText.length > 0,
      };

      await this.searchApp.setCriteria(searchQuery);
    } catch (error) {
      console.error("Search failed:", error);
    }
  }

  private handleClear(): void {
    this.searchApp.clear();
  }

  private updateResultCount(count: number): void {
    if (this._view) {
      this._view.webview.postMessage({
        type: "resultCount",
        count,
      });
    }
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    // For now, use inline scripts/styles - in production these would be proper URIs
    const scriptUri = "";
    const styleUri = "";

    const nonce = getNonce();

    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Prompt Search</title>
        <style>
          .search-container { padding: 10px; }
          .search-input-container { display: flex; margin-bottom: 10px; }
          #search-input { flex: 1; padding: 5px; }
          #clear-button { margin-left: 5px; padding: 5px 10px; }
          .search-options { margin-bottom: 10px; }
          .result-count { font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="search-container">
          <div class="search-input-container">
            <input
              type="text"
              id="search-input"
              placeholder="Search prompts..."
              autocomplete="off"
            />
            <button id="clear-button" title="Clear search">×</button>
          </div>
          <div class="search-options">
            <label>
              <input type="checkbox" id="case-sensitive" />
              Case sensitive
            </label>
            <label>
              <input type="checkbox" id="whole-word" />
              Whole word
            </label>
          </div>
          <div id="result-count" class="result-count"></div>
        </div>

        <script nonce="${nonce}">
          const vscode = acquireVsCodeApi();
          const $ = (id) => document.getElementById(id);

          const buildCriteria = () => ({
            query: $('search-input').value || '',
            scope: 'both',
            caseSensitive: $('case-sensitive').checked,
            matchWholeWord: $('whole-word').checked,
          });

          const sendSearch = () => {
            vscode.postMessage({ type: 'search', criteria: buildCriteria() });
          };

          $('search-input').addEventListener('input', sendSearch);
          $('case-sensitive').addEventListener('change', sendSearch);
          $('whole-word').addEventListener('change', sendSearch);

          $('clear-button').addEventListener('click', () => {
            $('search-input').value = '';
            vscode.postMessage({ type: 'clear' });
            // Optionally clear checkboxes on clear
            // $('case-sensitive').checked = false;
            // $('whole-word').checked = false;
            // sendSearch();
          });
        </script>
      </body>
      </html>`;
  }

  dispose(): void {
    // Clean up resources
  }
}

function getNonce(): string {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
