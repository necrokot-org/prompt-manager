import * as assert from "assert";
import * as vscode from "vscode";
import { SearchPanelProvider } from "../searchPanelProvider";
import { subscribe, publish } from "../core/eventBus";

suite("SearchPanelProvider", () => {
  let searchProvider: SearchPanelProvider;
  let mockUri: vscode.Uri;

  setup(() => {
    mockUri = vscode.Uri.file("/test/extension");
    searchProvider = new SearchPanelProvider(mockUri);
  });

  test("should create search provider", () => {
    assert.ok(searchProvider);
  });

  test("should publish search criteria changed event", (done) => {
    // Subscribe to the event
    subscribe("search.criteria.changed", (event: any) => {
      assert.strictEqual(event.type, "search.criteria.changed");
      assert.strictEqual(event.payload.query, "test");
      assert.strictEqual(event.payload.scope, "both");
      assert.strictEqual(event.payload.caseSensitive, false);
      assert.strictEqual(event.payload.isActive, true);
      done();
    });

    // Simulate the search provider publishing the event
    publish({
      type: "search.criteria.changed",
      source: "test",
      payload: {
        query: "test",
        scope: "both" as const,
        caseSensitive: false,
        isActive: true,
      },
    });
  });

  test("should publish search cleared event", (done) => {
    // Subscribe to the event
    subscribe("search.cleared", (event: any) => {
      assert.strictEqual(event.type, "search.cleared");
      done();
    });

    // Simulate the search provider publishing the event
    publish({
      type: "search.cleared",
      source: "test",
      payload: {},
    });
  });
});
