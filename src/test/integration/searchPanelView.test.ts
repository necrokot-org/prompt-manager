import { setup, teardown, suite, test } from "mocha";
import { expect } from "chai";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { SearchPanelView } from "../../presentation/search/SearchPanelView";
import { SearchApp } from "../../application/SearchApp";
import { SearchQuery } from "../../domain/model/SearchQuery";

suite("SearchPanelView", () => {
  let searchPanelView: SearchPanelView;
  let mockSearchApp: sinon.SinonStubbedInstance<SearchApp>;
  let mockWebviewView: sinon.SinonStubbedInstance<vscode.WebviewView>;
  let mockWebview: sinon.SinonStubbedInstance<vscode.Webview>;

  setup(() => {
    // Mock SearchApp
    mockSearchApp = {
      setCriteria: sinon.stub().resolves(),
      clear: sinon.stub(),
      getCurrentQuery: sinon.stub(),
      getResults: sinon.stub(),
      getResultsCount: sinon.stub(),
      onSearchChanged: new vscode.EventEmitter<void>().event,
      _onSearchChanged: new vscode.EventEmitter<void>(),
      onResultsCountChanged: new vscode.EventEmitter<number>().event,
      _onResultsCountChanged: new vscode.EventEmitter<number>(),
    } as any;

    // Mock Webview
    mockWebview = {
      options: {},
      html: "",
      onDidReceiveMessage: sinon.stub(),
      postMessage: sinon.stub(),
    } as any;

    // Mock WebviewView
    mockWebviewView = {
      webview: mockWebview,
    } as any;

    searchPanelView = new SearchPanelView(
      mockSearchApp,
      vscode.Uri.file("/mock/extension")
    );
  });

  teardown(() => {
    searchPanelView.dispose();
    sinon.restore();
  });

  suite("resolveWebviewView", () => {
    test("should set up webview with correct options", () => {
      // Mock vscode.extensions.getExtension to avoid accessing real extension
      const mockExtension = {
        extensionUri: vscode.Uri.file("/mock/extension"),
      };
      sinon
        .stub(vscode.extensions, "getExtension")
        .returns(mockExtension as any);

      searchPanelView.resolveWebviewView(mockWebviewView, {} as any, {} as any);

      expect(mockWebviewView.webview.options.enableScripts).to.be.true;
      expect(mockWebviewView.webview.options.localResourceRoots).to.be.an(
        "array"
      );
    });

    test("should set up message handler for search messages", () => {
      // Mock vscode.extensions.getExtension
      const mockExtension = {
        extensionUri: vscode.Uri.file("/mock/extension"),
      };
      sinon
        .stub(vscode.extensions, "getExtension")
        .returns(mockExtension as any);

      searchPanelView.resolveWebviewView(mockWebviewView, {} as any, {} as any);

      expect(mockWebview.onDidReceiveMessage.calledOnce).to.be.true;
    });
  });

  suite("Message handling", () => {
    setup(() => {
      // Mock vscode.extensions.getExtension for all message handling tests
      const mockExtension = {
        extensionUri: vscode.Uri.file("/mock/extension"),
      };
      sinon
        .stub(vscode.extensions, "getExtension")
        .returns(mockExtension as any);
    });

    test("should handle search message and call searchApp.setCriteria", async () => {
      searchPanelView.resolveWebviewView(mockWebviewView, {} as any, {} as any);

      const messageHandler = mockWebview.onDidReceiveMessage.firstCall.args[0];

      const searchCriteria = {
        query: "test query",
        scope: "both",
        caseSensitive: true,
        fuzzy: { maxEdits: 2 },
        maxSuggestions: 10,
      };

      await messageHandler({ type: "search", criteria: searchCriteria });

      expect(mockSearchApp.setCriteria.calledOnce).to.be.true;

      const calledWith = mockSearchApp.setCriteria.firstCall
        .args[0] as SearchQuery;
      expect(calledWith.query).to.equal("test query");
      expect(calledWith.scope).to.equal("both");
      expect(calledWith.caseSensitive).to.equal(true);
      expect(calledWith.fuzzy).to.deep.equal({ maxEdits: 2 });
      expect(calledWith.maxSuggestions).to.equal(10);
      expect(calledWith.isActive).to.equal(true);
    });

    test("should handle clear message and call searchApp.clear", async () => {
      searchPanelView.resolveWebviewView(mockWebviewView, {} as any, {} as any);

      const messageHandler = mockWebview.onDidReceiveMessage.firstCall.args[0];

      await messageHandler({ type: "clear" });

      expect(mockSearchApp.clear.calledOnce).to.be.true;
    });

    test("should handle search message with minimal criteria", async () => {
      searchPanelView.resolveWebviewView(mockWebviewView, {} as any, {} as any);

      const messageHandler = mockWebview.onDidReceiveMessage.firstCall.args[0];

      const minimalCriteria = { query: "simple" };

      await messageHandler({ type: "search", criteria: minimalCriteria });

      expect(mockSearchApp.setCriteria.calledOnce).to.be.true;

      const calledWith = mockSearchApp.setCriteria.firstCall
        .args[0] as SearchQuery;
      expect(calledWith.query).to.equal("simple");
      expect(calledWith.scope).to.equal("both"); // default
      expect(calledWith.caseSensitive).to.equal(false); // default
      expect(calledWith.isActive).to.equal(true);
    });

    test("should handle search message with case-sensitive and whole-word criteria", async () => {
      searchPanelView.resolveWebviewView(mockWebviewView, {} as any, {} as any);

      const messageHandler = mockWebview.onDidReceiveMessage.firstCall.args[0];

      const criteriaWithOptions = {
        query: "Test Query",
        scope: "both",
        caseSensitive: true,
        matchWholeWord: true,
      };

      await messageHandler({ type: "search", criteria: criteriaWithOptions });

      expect(mockSearchApp.setCriteria.calledOnce).to.be.true;

      const calledWith = mockSearchApp.setCriteria.firstCall
        .args[0] as SearchQuery;
      expect(calledWith.query).to.equal("Test Query");
      expect(calledWith.scope).to.equal("both");
      expect(calledWith.caseSensitive).to.equal(true);
      expect(calledWith.matchWholeWord).to.equal(true);
      expect(calledWith.isActive).to.equal(true);
    });
  });

  suite("Result count updates", () => {
    test("should post resultCount message when onResultsCountChanged fires", () => {
      // Mock vscode.extensions.getExtension
      const mockExtension = {
        extensionUri: vscode.Uri.file("/mock/extension"),
      };
      sinon
        .stub(vscode.extensions, "getExtension")
        .returns(mockExtension as any);

      searchPanelView.resolveWebviewView(mockWebviewView, {} as any, {} as any);

      // Trigger the results count changed event
      (mockSearchApp as any)._onResultsCountChanged.fire(42);

      expect(mockWebview.postMessage.calledOnce).to.be.true;
      expect(mockWebview.postMessage.firstCall.args[0]).to.deep.equal({
        type: "resultCount",
        count: 42,
      });
    });

    test("should not post message if webview is not resolved", () => {
      // Don't call resolveWebviewView, so _view remains undefined
      (mockSearchApp as any)._onResultsCountChanged.fire(10);

      expect(mockWebview.postMessage.notCalled).to.be.true;
    });
  });

  suite("WebviewViewProvider interface", () => {
    test("should have static viewType property", () => {
      expect(SearchPanelView.viewType).to.equal("promptManagerSearch");
    });

    test("should implement resolveWebviewView method", () => {
      expect(typeof searchPanelView.resolveWebviewView).to.equal("function");
    });
  });
});
