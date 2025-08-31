import { setup, teardown, suite, test } from "mocha";
import { expect } from "chai";
import * as sinon from "sinon";
import { FlexSearchEngine } from "../../infrastructure/search/FlexSearchEngine";
import {
  FlexSearchService,
  SearchScope,
} from "../../infrastructure/search/core/FlexSearchService";
import { SearchQuery } from "../../domain/model/SearchQuery";

suite("FlexSearchEngine", () => {
  let searchEngine: FlexSearchEngine;
  let mockFlexSearch: sinon.SinonStubbedInstance<FlexSearchService>;

  setup(() => {
    // Mock FlexSearchService
    mockFlexSearch = sinon.createStubInstance(FlexSearchService);

    // Create FlexSearchEngine with mocked dependency
    searchEngine = new FlexSearchEngine(mockFlexSearch);
  });

  teardown(() => {
    sinon.restore();
  });

  test("should ensure indexed with loader function", async () => {
    const mockFiles = [
      { path: "/test/prompt1.md", content: "# Prompt 1\n\nContent 1" },
      { path: "/test/prompt2.md", content: "# Prompt 2\n\nContent 2" },
    ];

    const loader = sinon.stub().resolves(mockFiles);
    mockFlexSearch.indexFiles.resolves();

    await searchEngine.ensureIndexed(loader);

    expect(loader.calledOnce).to.be.true;
    expect(mockFlexSearch.indexFiles.calledOnce).to.be.true;
    expect(
      mockFlexSearch.indexFiles.calledWith([
        {
          path: "/test/prompt1.md",
          content: "# Prompt 1\n\nContent 1",
        },
        {
          path: "/test/prompt2.md",
          content: "# Prompt 2\n\nContent 2",
        },
      ])
    ).to.be.true;
  });

  test("should search with active query", () => {
    const searchQuery: SearchQuery = {
      query: "test query",
      scope: "both",
      caseSensitive: false,
      isActive: true,
    };

    const mockResults = [
      {
        id: "/test/prompt1.md",
        score: 0.8,
        matches: { content: ["test"], title: ["query"] },
      },
    ];

    mockFlexSearch.search.returns(mockResults);

    const results = searchEngine.search(searchQuery);

    expect(mockFlexSearch.search.calledOnce).to.be.true;
    expect(mockFlexSearch.search.firstCall.args[0]).to.deep.equal({
      query: "test query",
      scope: SearchScope.ALL,
      caseSensitive: false,
      fuzzy: false,
      suggest: false,
      limit: 100,
    });

    expect(results).to.deep.equal(mockResults);
  });

  test("should search with fuzzy options", () => {
    const searchQuery: SearchQuery = {
      query: "test query",
      scope: "content",
      caseSensitive: true,
      fuzzy: {
        maxEdits: 2,
        prefix: true,
        caseSensitive: false,
      },
      isActive: true,
    };

    const mockResults = [
      {
        id: "/test/prompt1.md",
        score: 0.6,
        matches: { content: ["test"] },
      },
    ];

    mockFlexSearch.search.returns(mockResults);

    const results = searchEngine.search(searchQuery);

    expect(mockFlexSearch.search.firstCall.args[0]).to.deep.equal({
      query: "test query",
      scope: SearchScope.CONTENT,
      caseSensitive: true,
      fuzzy: 2,
      suggest: false,
      limit: 100,
    });

    expect(results).to.deep.equal(mockResults);
  });

  test("should search with suggestions limit", () => {
    const searchQuery: SearchQuery = {
      query: "test",
      scope: "both",
      isActive: true,
      maxSuggestions: 5,
    };

    const mockResults = [
      {
        id: "/test/prompt1.md",
        score: 0.9,
        matches: { title: ["test"] },
      },
    ];

    mockFlexSearch.search.returns(mockResults);

    const results = searchEngine.search(searchQuery);

    expect(mockFlexSearch.search.firstCall.args[0].limit).to.equal(5);
    expect(results).to.deep.equal(mockResults);
  });

  test("should return empty array when query is not active", () => {
    const searchQuery: SearchQuery = {
      query: "test query",
      scope: "both",
      isActive: false,
    };

    const results = searchEngine.search(searchQuery);

    expect(mockFlexSearch.search.notCalled).to.be.true;
    expect(results).to.be.an("array").that.is.empty;
  });

  test("should map scope correctly", () => {
    const testCases = [
      { scope: "content", expected: SearchScope.CONTENT },
      { scope: "filename", expected: SearchScope.TITLES },
      { scope: "both", expected: SearchScope.ALL },
    ];

    testCases.forEach(({ scope, expected }) => {
      const searchQuery: SearchQuery = {
        query: "test",
        scope: scope as any,
        isActive: true,
      };

      searchEngine.search(searchQuery);

      const searchOptions = mockFlexSearch.search.lastCall.args[0];
      expect(searchOptions.scope).to.equal(expected);
    });
  });

  test("should match file with search query", async () => {
    const searchQuery: SearchQuery = {
      query: "test content",
      scope: "both",
      isActive: true,
    };

    const file = {
      path: "/test/prompt.md",
      content: "# Test Prompt\n\nThis is test content",
    };

    const mockResults = [
      {
        id: "/test/prompt.md",
        score: 0.7,
        matches: { content: ["test", "content"] },
      },
    ];

    mockFlexSearch.search.returns(mockResults);

    const matches = await searchEngine.matches(file, searchQuery);

    expect(matches).to.be.true;
    expect(mockFlexSearch.search.calledOnce).to.be.true;
  });

  test("should not match file when no search results", async () => {
    const searchQuery: SearchQuery = {
      query: "nonexistent",
      scope: "both",
      isActive: true,
    };

    const file = {
      path: "/test/prompt.md",
      content: "# Test Prompt\n\nContent",
    };

    mockFlexSearch.search.returns([]);

    const matches = await searchEngine.matches(file, searchQuery);

    expect(matches).to.be.false;
  });

  test("should return false when query is not active", async () => {
    const searchQuery: SearchQuery = {
      query: "test",
      scope: "both",
      isActive: false,
    };

    const file = {
      path: "/test/prompt.md",
      content: "content",
    };

    const matches = await searchEngine.matches(file, searchQuery);

    expect(matches).to.be.false;
    expect(mockFlexSearch.search.notCalled).to.be.true;
  });

  test("should upsert file to search index", () => {
    const file = {
      path: "/test/prompt.md",
      content: "# Test Prompt\n\nContent",
    };

    mockFlexSearch.upsertDocument.resolves();

    searchEngine.upsert(file);

    expect(mockFlexSearch.upsertDocument.calledOnce).to.be.true;
    expect(mockFlexSearch.upsertDocument.calledWith(file)).to.be.true;
  });

  test("should remove file from search index", () => {
    const filePath = "/test/prompt.md";

    mockFlexSearch.removeDocument.resolves();

    searchEngine.remove(filePath);

    expect(mockFlexSearch.removeDocument.calledOnce).to.be.true;
    expect(mockFlexSearch.removeDocument.calledWith("/test/prompt.md")).to.be
      .true;
  });

  test("should clear search index", () => {
    mockFlexSearch.clearCache.resolves();

    searchEngine.clear();

    expect(mockFlexSearch.clearCache.calledOnce).to.be.true;
  });

  test("should handle empty query", () => {
    const searchQuery: SearchQuery = {
      query: "",
      scope: "both",
      isActive: true,
    };

    mockFlexSearch.search.returns([]);

    const results = searchEngine.search(searchQuery);

    expect(results).to.be.an("array").that.is.empty;
  });

  test("should handle undefined fuzzy options", () => {
    const searchQuery: SearchQuery = {
      query: "test",
      scope: "both",
      isActive: true,
      fuzzy: undefined,
    };

    mockFlexSearch.search.returns([]);

    searchEngine.search(searchQuery);

    const searchOptions = mockFlexSearch.search.lastCall.args[0];
    expect(searchOptions.fuzzy).to.be.false;
  });

  test("should search with case-sensitive option", () => {
    const searchQuery: SearchQuery = {
      query: "Test",
      scope: "both",
      caseSensitive: true,
      isActive: true,
    };

    const mockResults = [
      {
        id: "/test/prompt1.md",
        score: 0.8,
        matches: { content: ["Test"] },
      },
    ];

    mockFlexSearch.search.returns(mockResults);

    const results = searchEngine.search(searchQuery);

    expect(mockFlexSearch.search.calledOnce).to.be.true;
    expect(mockFlexSearch.search.firstCall.args[0]).to.deep.equal({
      query: "Test",
      scope: SearchScope.ALL,
      caseSensitive: true,
      fuzzy: false,
      suggest: false,
      limit: 100,
    });

    expect(results).to.deep.equal(mockResults);
  });

  test("should search with case-insensitive option (default)", () => {
    const searchQuery: SearchQuery = {
      query: "test",
      scope: "both",
      caseSensitive: false,
      isActive: true,
    };

    const mockResults = [
      {
        id: "/test/prompt1.md",
        score: 0.8,
        matches: { content: ["test", "Test"] },
      },
    ];

    mockFlexSearch.search.returns(mockResults);

    const results = searchEngine.search(searchQuery);

    expect(mockFlexSearch.search.calledOnce).to.be.true;
    expect(mockFlexSearch.search.firstCall.args[0]).to.deep.equal({
      query: "test",
      scope: SearchScope.ALL,
      caseSensitive: false,
      fuzzy: false,
      suggest: false,
      limit: 100,
    });

    expect(results).to.deep.equal(mockResults);
  });
});
