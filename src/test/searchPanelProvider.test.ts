import * as assert from "assert";
import * as vscode from "vscode";
import { SearchPanelProvider } from "../searchPanelProvider";
import { ExtensionEventBus } from "../core/EventSystem";

suite("SearchPanelProvider Tests", () => {
  let searchProvider: SearchPanelProvider;
  let mockEventBus: ExtensionEventBus;

  setup(() => {
    const mockUri = vscode.Uri.file("/test/path");
    mockEventBus = new ExtensionEventBus();
    searchProvider = new SearchPanelProvider(mockUri, mockEventBus);
  });

  teardown(() => {
    if (mockEventBus) {
      mockEventBus.dispose();
    }
  });

  test("Constructor initializes correctly", () => {
    assert.ok(searchProvider);
    assert.strictEqual(searchProvider.getCurrentSearchCriteria().query, "");
    assert.strictEqual(searchProvider.getCurrentSearchCriteria().scope, "both");
    assert.strictEqual(
      searchProvider.getCurrentSearchCriteria().caseSensitive,
      false
    );
    assert.strictEqual(
      searchProvider.getCurrentSearchCriteria().isActive,
      false
    );
  });

  test("Webview Provider implements interface", () => {
    assert.strictEqual(SearchPanelProvider.viewType, "promptManagerSearch");
  });

  test("Search Event Publication via Event Bus", (done) => {
    let eventReceived = false;

    // Subscribe to search criteria changed event
    mockEventBus.subscribe("search.criteria.changed", (event) => {
      eventReceived = true;
      const searchEvent = event as any;
      assert.strictEqual(searchEvent.payload.query, "test search");
      assert.strictEqual(searchEvent.payload.scope, "content");
      assert.strictEqual(searchEvent.payload.caseSensitive, true);
      assert.strictEqual(searchEvent.payload.isActive, true);
      assert.strictEqual(searchEvent.source, "SearchPanelProvider");
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

  test("Clear Search Event Publication", (done) => {
    let eventReceived = false;

    // Subscribe to search cleared event
    mockEventBus.subscribe("search.cleared", (event) => {
      eventReceived = true;
      const searchEvent = event as any;
      assert.strictEqual(searchEvent.source, "SearchPanelProvider");
      done();
    });

    // Mock a webview view to test clear message handling
    const mockWebview = {
      options: {},
      html: "",
      onDidReceiveMessage: (handler: (message: any) => void) => {
        // Simulate clear search message
        setTimeout(() => {
          handler({
            type: "clearSearch",
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

  test("HTML Generation", () => {
    const mockWebview = {
      asWebviewUri: (uri: vscode.Uri) => uri,
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

    // Should not throw when resolving webview
    assert.doesNotThrow(() => {
      searchProvider.resolveWebviewView(
        mockWebviewView as any,
        {} as any,
        {} as any
      );
    });
  });

  test("Result Count Update", () => {
    const mockWebview = {
      postMessage: (message: any) => {
        assert.strictEqual(message.type, "updateResultCount");
        assert.strictEqual(message.count, 5);
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

    // Set up the webview
    searchProvider.resolveWebviewView(
      mockWebviewView as any,
      {} as any,
      {} as any
    );

    // Update result count
    searchProvider.updateResultCount(5);
  });

  test("Multiple Search Criteria Updates", (done) => {
    let eventCount = 0;
    const expectedEvents = 2;

    mockEventBus.subscribe("search.criteria.changed", (event) => {
      eventCount++;
      if (eventCount === expectedEvents) {
        done();
      }
    });

    // Mock webview for multiple messages
    const mockWebview = {
      options: {},
      html: "",
      onDidReceiveMessage: (handler: (message: any) => void) => {
        setTimeout(() => {
          handler({
            type: "searchChanged",
            query: "first search",
            scope: "titles",
            caseSensitive: false,
          });
        }, 10);

        setTimeout(() => {
          handler({
            type: "searchChanged",
            query: "second search",
            scope: "content",
            caseSensitive: true,
          });
        }, 20);

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
});
