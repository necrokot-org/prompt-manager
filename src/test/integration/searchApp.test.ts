import { setup, teardown, suite, test } from "mocha";
import { expect } from "chai";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { SearchApp } from "../../application/SearchApp";
import { SearchQuery } from "../../domain/model/SearchQuery";
import { SearchEngine } from "../../application/ports/SearchEngine";
import { PromptApp } from "../../application/PromptApp";
import { SearchPromptFilter } from "../../application/filters/SearchPromptFilter";
import { PromptStructure } from "../../domain/model/PromptStructure";

suite("SearchApp", () => {
  let searchApp: SearchApp;
  let mockSearchEngine: any;
  let mockPromptApp: any;
  let mockSearchFilter: any;

  setup(() => {
    // Mock dependencies
    mockSearchEngine = {
      ensureIndexed: sinon.stub().resolves(),
      search: sinon.stub().returns([]),
    };

    mockPromptApp = {
      structure: sinon.stub().resolves({ folders: [], rootPrompts: [] }),
      copyContent: sinon.stub().resolves("test content"),
      onTreeChanged: new vscode.EventEmitter<void>().event,
      _onTreeChanged: new vscode.EventEmitter<void>(),
    } as any;

    mockSearchFilter = {
      setCriteria: sinon.stub(),
    };

    searchApp = new SearchApp(
      mockSearchEngine,
      mockPromptApp,
      mockSearchFilter
    );
  });

  teardown(() => {
    sinon.restore();
  });

  suite("setCriteria", () => {
    test("should update filter and perform search when query is active", async () => {
      const searchQuery: SearchQuery = {
        query: "test search",
        scope: "both",
        caseSensitive: false,
        isActive: true,
      };

      const mockResults = [
        {
          id: "/test/prompt.md",
          score: 0.8,
          matches: { content: ["test"] },
        },
      ];

      const mockStructure: PromptStructure = {
        folders: [],
        rootPrompts: [
          {
            name: "prompt.md",
            title: "Test",
            path: "/test/prompt.md",
            description: "Test",
            tags: [],
            fileSize: 100,
          },
        ],
      };

      mockPromptApp.structure.resolves(mockStructure);
      mockPromptApp.copyContent.resolves(
        "---\ntitle: Test\n---\n\ntest content"
      );
      mockSearchEngine.search.returns(mockResults);

      await searchApp.setCriteria(searchQuery);

      expect(mockSearchFilter.setCriteria.calledOnce).to.be.true;
      expect(mockSearchFilter.setCriteria.calledWith(searchQuery)).to.be.true;
      expect(mockSearchEngine.ensureIndexed.calledOnce).to.be.true;
      expect(mockSearchEngine.search.calledOnce).to.be.true;
      expect(searchApp.getResults()).to.deep.equal(mockResults);
      expect(searchApp.getResultsCount()).to.equal(1);
    });

    test("should clear results when query is not active", async () => {
      const searchQuery: SearchQuery = {
        query: "test",
        scope: "both",
        isActive: false,
      };

      let countChangedEvent = 0;
      const subscription = searchApp.onResultsCountChanged((count) => {
        countChangedEvent = count;
      });

      await searchApp.setCriteria(searchQuery);

      expect(searchApp.getResults()).to.be.an("array").that.is.empty;
      expect(searchApp.getResultsCount()).to.equal(0);
      expect(countChangedEvent).to.equal(0);

      subscription.dispose();
    });

    test("should fire onSearchChanged event", async () => {
      let eventFired = false;
      const subscription = searchApp.onSearchChanged(() => {
        eventFired = true;
      });

      const searchQuery: SearchQuery = {
        query: "test",
        scope: "both",
        isActive: true,
      };

      await searchApp.setCriteria(searchQuery);

      expect(eventFired).to.be.true;
      subscription.dispose();
    });

    test("should fire onResultsCountChanged event with correct count", async () => {
      const mockResults = [
        { id: "/test/1.md", score: 0.8, matches: {} },
        { id: "/test/2.md", score: 0.6, matches: {} },
      ];

      mockSearchEngine.search.returns(mockResults);

      let countChangedEvent = 0;
      const subscription = searchApp.onResultsCountChanged((count) => {
        countChangedEvent = count;
      });

      const searchQuery: SearchQuery = {
        query: "test",
        scope: "both",
        isActive: true,
      };

      await searchApp.setCriteria(searchQuery);

      expect(countChangedEvent).to.equal(2);
      subscription.dispose();
    });
  });

  suite("clear", () => {
    test("should clear current query and results", () => {
      // Set up some initial state
      (searchApp as any).currentQuery = { query: "test", isActive: true };
      (searchApp as any).lastResults = [
        { id: "/test.md", score: 1, matches: {} },
      ];

      searchApp.clear();

      expect(searchApp.getCurrentQuery()).to.be.null;
      expect(searchApp.getResults()).to.be.an("array").that.is.empty;
      expect(searchApp.getResultsCount()).to.equal(0);
    });

    test("should fire events when clearing", () => {
      let searchChanged = false;
      let countChanged = 0;

      const searchSubscription = searchApp.onSearchChanged(() => {
        searchChanged = true;
      });

      const countSubscription = searchApp.onResultsCountChanged((count) => {
        countChanged = count;
      });

      searchApp.clear();

      expect(searchChanged).to.be.true;
      expect(countChanged).to.equal(0);

      searchSubscription.dispose();
      countSubscription.dispose();
    });
  });

  suite("suggest", () => {
    test("should return suggestions with title and snippet extraction", async () => {
      const searchQuery: SearchQuery = {
        query: "test",
        scope: "both",
        isActive: true,
      };

      const mockResults = [
        {
          id: "/test/prompt.md",
          score: 0.8,
          matches: { content: ["test"] },
        },
      ];

      mockSearchEngine.search.returns(mockResults);
      mockPromptApp.copyContent
        .onCall(0)
        .resolves("---\ntitle: Test Prompt\n---\n\nThis is test content");
      mockPromptApp.copyContent.onCall(1).resolves("This is test content");

      const suggestions = await searchApp.suggest(searchQuery);

      expect(suggestions).to.have.lengthOf(1);
      expect(suggestions[0]).to.deep.equal({
        id: "/test/prompt.md",
        title: "Test Prompt",
        snippet: "This is test content",
      });
    });

    test("should return empty array for empty query", async () => {
      const searchQuery: SearchQuery = {
        query: "",
        scope: "both",
        isActive: true,
      };

      const suggestions = await searchApp.suggest(searchQuery);

      expect(suggestions).to.be.an("array").that.is.empty;
    });

    test("should extract title from first heading when no frontmatter", async () => {
      const mockResults = [
        {
          id: "/test/prompt.md",
          score: 0.8,
          matches: {},
        },
      ];

      mockSearchEngine.search.returns(mockResults);
      mockPromptApp.copyContent.onCall(0).resolves("# My Title\n\nContent");
      mockPromptApp.copyContent.onCall(1).resolves("Content");

      const suggestions = await searchApp.suggest({
        query: "test",
        scope: "both",
        isActive: true,
      });

      expect(suggestions[0].title).to.equal("My Title");
    });

    test("should fallback to filename when title extraction fails", async () => {
      const mockResults = [
        {
          id: "/test/prompt.md",
          score: 0.8,
          matches: {},
        },
      ];

      mockSearchEngine.search.returns(mockResults);
      mockPromptApp.copyContent.rejects(new Error("Read failed"));

      const suggestions = await searchApp.suggest({
        query: "test",
        scope: "both",
        isActive: true,
      });

      expect(suggestions[0].title).to.equal("prompt.md");
    });
  });

  suite("getCurrentQuery", () => {
    test("should return null when no query is set", () => {
      expect(searchApp.getCurrentQuery()).to.be.null;
    });

    test("should return the current query", () => {
      const query: SearchQuery = {
        query: "test",
        scope: "both",
        isActive: true,
      };

      (searchApp as any).currentQuery = query;

      expect(searchApp.getCurrentQuery()).to.equal(query);
    });
  });

  suite("getResults", () => {
    test("should return copy of results array", () => {
      const results = [{ id: "/test.md", score: 1, matches: {} }];
      (searchApp as any).lastResults = results;

      const returnedResults = searchApp.getResults();

      expect(returnedResults).to.deep.equal(results);
      expect(returnedResults).to.not.equal(results); // Should be a copy
    });
  });

  suite("getResultsCount", () => {
    test("should return the number of results", () => {
      (searchApp as any).lastResults = [
        { id: "/test1.md", score: 1, matches: {} },
        { id: "/test2.md", score: 0.8, matches: {} },
      ];

      expect(searchApp.getResultsCount()).to.equal(2);
    });

    test("should return 0 when no results", () => {
      (searchApp as any).lastResults = [];

      expect(searchApp.getResultsCount()).to.equal(0);
    });
  });

  suite("Event integration", () => {
    test("should re-index and search when prompt structure changes and query is active", async () => {
      const searchQuery: SearchQuery = {
        query: "test",
        scope: "both",
        isActive: true,
      };

      // Set an active query
      await searchApp.setCriteria(searchQuery);

      // Reset mocks to check if they're called again
      mockSearchEngine.ensureIndexed.resetHistory();
      mockSearchEngine.search.resetHistory();

      const mockStructure: PromptStructure = {
        folders: [],
        rootPrompts: [
          {
            name: "new-prompt.md",
            title: "New",
            path: "/test/new-prompt.md",
            description: "New",
            tags: [],
            fileSize: 100,
          },
        ],
      };

      mockPromptApp.structure.resolves(mockStructure);
      mockPromptApp.copyContent.resolves("content");
      mockSearchEngine.search.returns([]);

      // Trigger the event by calling the event emitter
      (mockPromptApp as any)._onTreeChanged.fire();

      // Give it a moment to process
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockSearchEngine.ensureIndexed.called).to.be.true;
      expect(mockSearchEngine.search.called).to.be.true;
    });

    test("should not re-index when query is not active", async () => {
      const searchQuery: SearchQuery = {
        query: "test",
        scope: "both",
        isActive: false,
      };

      await searchApp.setCriteria(searchQuery);

      mockSearchEngine.ensureIndexed.resetHistory();

      // Trigger the event by calling the event emitter
      (mockPromptApp as any)._onTreeChanged.fire();

      // Give it a moment to process
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockSearchEngine.ensureIndexed.notCalled).to.be.true;
    });
  });

  suite("Event handling", () => {
    test("should expose onSearchChanged event", () => {
      expect(typeof searchApp.onSearchChanged).to.equal("function");
    });

    test("should expose onResultsCountChanged event", () => {
      expect(typeof searchApp.onResultsCountChanged).to.equal("function");
    });
  });
});
