import { expect } from "chai";
import {
  MiniSearchEngine,
  FileContent,
} from "@features/search/core/MiniSearchEngine";
import { SearchCriteria } from "@features/search/types/SearchCriteria";

suite("MiniSearchEngine Case Sensitivity and Scope", () => {
  let searchEngine: MiniSearchEngine;

  setup(() => {
    searchEngine = new MiniSearchEngine();
  });

  teardown(() => {
    searchEngine.clearCache();
  });

  const testFiles: FileContent[] = [
    {
      path: "/test/exact-match.md",
      content: `---
title: "JavaScript Programming"
description: "Learn JavaScript with examples"
tags: ["programming", "tutorial"]
---

JavaScript is a programming language used for web development.
It has many features like variables, functions, and objects.`,
    },
    {
      path: "/test/case-sensitive.md",
      content: `---
title: "JAVASCRIPT advanced"
description: "Advanced concepts"
tags: ["advanced"]
---

This covers ADVANCED JAVASCRIPT concepts including closures.`,
    },
  ];

  test("should handle case sensitive search", async () => {
    const criteria: SearchCriteria = {
      query: "JAVASCRIPT",
      scope: "both",
      caseSensitive: true,
      fuzzy: false,
      isActive: true,
    };

    const results = await searchEngine.search(testFiles, criteria);
    expect(results.length).to.equal(1);
    expect(results[0].title).to.equal("JAVASCRIPT advanced");
  });

  test("should handle case insensitive search", async () => {
    const criteria: SearchCriteria = {
      query: "javascript",
      scope: "both",
      caseSensitive: false,
      fuzzy: false,
      isActive: true,
    };

    const results = await searchEngine.search(testFiles, criteria);
    expect(results.length).to.equal(2);
  });

  test("should search only in titles", async () => {
    const criteria: SearchCriteria = {
      query: "Programming",
      scope: "titles",
      caseSensitive: false,
      fuzzy: false,
      isActive: true,
    };

    const results = await searchEngine.search(testFiles, criteria);
    expect(results.length).to.equal(1);
    expect(results[0].title).to.equal("JavaScript Programming");
  });

  test("should search only in content", async () => {
    const criteria: SearchCriteria = {
      query: "closures",
      scope: "content",
      caseSensitive: false,
      fuzzy: false,
      isActive: true,
    };

    const results = await searchEngine.search(testFiles, criteria);
    expect(results.length).to.equal(1);
    expect(results[0].title).to.equal("JAVASCRIPT advanced");
  });
});
