import * as assert from "assert";
import * as vscode from "vscode";
import { SearchPanelProvider } from "@features/search/ui/SearchPanelProvider";
import { eventBus } from "@infra/vscode/ExtensionBus";

suite("SearchPanelProvider", () => {
  let searchProvider: SearchPanelProvider;
  let mockContext: vscode.ExtensionContext;

  setup(() => {
    const mockUri = vscode.Uri.file("/test/extension");
    mockContext = {
      extensionUri: mockUri,
      subscriptions: [],
      workspaceState: {} as any,
      globalState: {} as any,
      secrets: {} as any,
      extensionMode: vscode.ExtensionMode.Test,
      extensionPath: "/test/extension",
      environmentVariableCollection: {} as any,
      asAbsolutePath: (relativePath: string) =>
        `/test/extension/${relativePath}`,
      storageUri: mockUri,
      globalStorageUri: mockUri,
      logUri: mockUri,
    } as any;

    searchProvider = new SearchPanelProvider(mockContext);
  });

  test("should create search provider", () => {
    assert.ok(searchProvider);
  });

  test("should publish search criteria changed event", (done) => {
    // Listen to event
    eventBus.on("search.criteria.changed", (payload) => {
      assert.strictEqual(payload.query, "test");
      assert.strictEqual(payload.scope, "both");
      assert.strictEqual(payload.caseSensitive, false);
      assert.strictEqual(payload.isActive, true);
      done();
    });

    // Emit event
    eventBus.emit("search.criteria.changed", {
      query: "test",
      scope: "both",
      caseSensitive: false,
      isActive: true,
    });
  });

  test("should publish search cleared event", (done) => {
    // Listen to the event
    eventBus.on("search.cleared", () => {
      done();
    });

    // Emit
    eventBus.emit("search.cleared", {});
  });
});
