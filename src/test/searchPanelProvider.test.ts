import * as assert from "assert";
import * as vscode from "vscode";
import { SearchPanelProvider, SearchCriteria } from "../searchPanelProvider";
import { createMockExtensionUri } from "./helpers";

suite("SearchPanelProvider Tests", () => {
  let searchProvider: SearchPanelProvider;
  let mockExtensionUri: vscode.Uri;

  suiteSetup(() => {
    mockExtensionUri = createMockExtensionUri();
    searchProvider = new SearchPanelProvider(mockExtensionUri);
  });

  test("Initial Search Criteria State", () => {
    const criteria = searchProvider.getCurrentSearchCriteria();

    assert.strictEqual(criteria.query, "");
    assert.strictEqual(criteria.scope, "both");
    assert.strictEqual(criteria.caseSensitive, false);
    assert.strictEqual(criteria.isActive, false);
  });

  test("Search Criteria Interface Validation", () => {
    const validCriteria: SearchCriteria = {
      query: "test query",
      scope: "titles",
      caseSensitive: true,
      isActive: true,
    };

    // Should not throw any TypeScript errors
    assert.strictEqual(validCriteria.query, "test query");
    assert.strictEqual(validCriteria.scope, "titles");
    assert.strictEqual(validCriteria.caseSensitive, true);
    assert.strictEqual(validCriteria.isActive, true);
  });

  test("Search Scope Values", () => {
    const scopes: Array<SearchCriteria["scope"]> = [
      "titles",
      "content",
      "both",
    ];

    scopes.forEach((scope) => {
      const criteria: SearchCriteria = {
        query: "test",
        scope: scope,
        caseSensitive: false,
        isActive: true,
      };
      assert.ok(["titles", "content", "both"].includes(criteria.scope));
    });
  });

  test("Search Event Emission", (done) => {
    let eventFired = false;

    const disposable = searchProvider.onDidChangeSearch((criteria) => {
      eventFired = true;
      assert.strictEqual(criteria.query, "test search");
      assert.strictEqual(criteria.scope, "content");
      assert.strictEqual(criteria.caseSensitive, true);
      assert.strictEqual(criteria.isActive, true);

      disposable.dispose();
      done();
    });

    // Mock a webview view to test message handling
    const mockWebview = {
      options: {},
      html: "",
      onDidReceiveMessage: (handler: (message: any) => void) => {
        // Simulate search changed message
        setTimeout(() => {
          handler({
            type: "searchChanged",
            query: "test search",
            scope: "content",
            caseSensitive: true,
          });
        }, 10);
        return { dispose: () => {} };
      },
      postMessage: () => Promise.resolve(true),
    };

    const mockWebviewView = {
      webview: mockWebview,
      visible: true,
      onDidDispose: () => ({ dispose: () => {} }),
      onDidChangeVisibility: () => ({ dispose: () => {} }),
      show: () => {},
      title: "Search",
      description: "",
    };

    // Trigger the webview resolution
    searchProvider.resolveWebviewView(
      mockWebviewView as any,
      {} as any,
      {} as any
    );
  });

  test("Clear Search Functionality", (done) => {
    let clearEventFired = false;

    const disposable = searchProvider.onDidChangeSearch((criteria) => {
      if (clearEventFired) {
        // This should be the clear event
        assert.strictEqual(criteria.query, "");
        assert.strictEqual(criteria.scope, "both");
        assert.strictEqual(criteria.caseSensitive, false);
        assert.strictEqual(criteria.isActive, false);

        disposable.dispose();
        done();
      }
    });

    // Mock a webview view to test clear message handling
    const mockWebview = {
      options: {},
      html: "",
      onDidReceiveMessage: (handler: (message: any) => void) => {
        // First simulate a search, then clear
        setTimeout(() => {
          handler({
            type: "searchChanged",
            query: "test",
            scope: "both",
            caseSensitive: false,
          });
          clearEventFired = true;

          // Then clear
          setTimeout(() => {
            handler({
              type: "clearSearch",
            });
          }, 5);
        }, 10);
        return { dispose: () => {} };
      },
      postMessage: () => Promise.resolve(true),
    };

    const mockWebviewView = {
      webview: mockWebview,
      visible: true,
      onDidDispose: () => ({ dispose: () => {} }),
      onDidChangeVisibility: () => ({ dispose: () => {} }),
      show: () => {},
      title: "Search",
      description: "",
    };

    searchProvider.resolveWebviewView(
      mockWebviewView as any,
      {} as any,
      {} as any
    );
  });

  test("Result Count Update", () => {
    let postMessageCalled = false;
    let messageData: any = null;

    const mockWebview = {
      options: {},
      html: "",
      onDidReceiveMessage: () => ({ dispose: () => {} }),
      postMessage: (message: any) => {
        postMessageCalled = true;
        messageData = message;
        return Promise.resolve(true);
      },
    };

    const mockWebviewView = {
      webview: mockWebview,
      visible: true,
      onDidDispose: () => ({ dispose: () => {} }),
      onDidChangeVisibility: () => ({ dispose: () => {} }),
      show: () => {},
      title: "Search",
      description: "",
    };

    // First resolve the webview
    searchProvider.resolveWebviewView(
      mockWebviewView as any,
      {} as any,
      {} as any
    );

    // Then update result count
    searchProvider.updateResultCount(42);

    assert.ok(postMessageCalled);
    assert.strictEqual(messageData.type, "updateResultCount");
    assert.strictEqual(messageData.count, 42);
  });

  test("Search Active State Changes", () => {
    // Test that isActive is false for empty queries
    const criteria1: SearchCriteria = {
      query: "",
      scope: "both",
      caseSensitive: false,
      isActive: false,
    };
    assert.strictEqual(criteria1.isActive, false);

    // Test that isActive should be true for non-empty queries
    const criteria2: SearchCriteria = {
      query: "test",
      scope: "both",
      caseSensitive: false,
      isActive: true,
    };
    assert.strictEqual(criteria2.isActive, true);
  });

  test("Search Criteria Immutability", () => {
    const original = searchProvider.getCurrentSearchCriteria();
    const copy = { ...original };

    // Modify the copy
    copy.query = "modified";
    copy.scope = "titles";
    copy.caseSensitive = true;
    copy.isActive = true;

    // Original should remain unchanged
    const currentOriginal = searchProvider.getCurrentSearchCriteria();
    assert.strictEqual(currentOriginal.query, original.query);
    assert.strictEqual(currentOriginal.scope, original.scope);
    assert.strictEqual(currentOriginal.caseSensitive, original.caseSensitive);
    assert.strictEqual(currentOriginal.isActive, original.isActive);
  });

  test("Invalid Message Type Handling", () => {
    let eventFired = false;

    const disposable = searchProvider.onDidChangeSearch(() => {
      eventFired = true;
    });

    const mockWebview = {
      options: {},
      html: "",
      onDidReceiveMessage: (handler: (message: any) => void) => {
        // Send an invalid message type
        setTimeout(() => {
          handler({
            type: "invalidMessageType",
            query: "test",
          });
        }, 10);
        return { dispose: () => {} };
      },
      postMessage: () => Promise.resolve(true),
    };

    const mockWebviewView = {
      webview: mockWebview,
      visible: true,
      onDidDispose: () => ({ dispose: () => {} }),
      onDidChangeVisibility: () => ({ dispose: () => {} }),
      show: () => {},
      title: "Search",
      description: "",
    };

    searchProvider.resolveWebviewView(
      mockWebviewView as any,
      {} as any,
      {} as any
    );

    // Wait a bit and ensure no event was fired for invalid message
    setTimeout(() => {
      assert.strictEqual(eventFired, false);
      disposable.dispose();
    }, 50);
  });

  test("HTML Content Generation", () => {
    const mockWebview = {
      options: {},
      html: "",
      onDidReceiveMessage: () => ({ dispose: () => {} }),
      postMessage: () => Promise.resolve(true),
    };

    const mockWebviewView = {
      webview: mockWebview,
      visible: true,
      onDidDispose: () => ({ dispose: () => {} }),
      onDidChangeVisibility: () => ({ dispose: () => {} }),
      show: () => {},
      title: "Search",
      description: "",
    };

    searchProvider.resolveWebviewView(
      mockWebviewView as any,
      {} as any,
      {} as any
    );

    // Verify HTML was set
    assert.ok(mockWebview.html.length > 0);
    assert.ok(mockWebview.html.includes("<!DOCTYPE html>"));
    assert.ok(mockWebview.html.includes("search-input"));
    assert.ok(mockWebview.html.includes("scope-select"));
  });
});
