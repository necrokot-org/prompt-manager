import { expect } from "chai";
import {
  MiniSearchEngine,
  FileContent,
} from "@features/search/core/MiniSearchEngine";
import { SearchCriteria } from "@features/search/types/SearchCriteria";

suite("MiniSearchEngine Basic Queries", () => {
  let searchEngine: MiniSearchEngine;

  setup(() => {
    searchEngine = new MiniSearchEngine();
  });

  teardown(() => {
    searchEngine.clearCache();
  });

  const testFiles: FileContent[] = [
    {
      path: "/test/file1.md",
      content: `---
title: "JavaScript Basics"
tags: ["programming", "beginner"]
---

Learn the fundamentals of JavaScript programming.`,
    },
    {
      path: "/test/file2.md",
      content: `---
title: "Advanced JavaScript"
tags: ["programming", "advanced"]
---

Deep dive into advanced JavaScript concepts.`,
    },
  ];

  test("should find files with simple query", async () => {
    const criteria: SearchCriteria = {
      query: "JavaScript",
      scope: "both",
      caseSensitive: false,
      fuzzy: false,
      isActive: true,
    };

    const results = await searchEngine.search(testFiles, criteria);
    expect(results.length).to.equal(2);
    expect(results.some((r) => r.title === "JavaScript Basics")).to.be.true;
    expect(results.some((r) => r.title === "Advanced JavaScript")).to.be.true;
  });

  test("should handle fuzzy search", async () => {
    const criteria: SearchCriteria = {
      query: "JavaScipt", // Intentional typo
      scope: "both",
      caseSensitive: false,
      fuzzy: true,
      isActive: true,
    };

    const results = await searchEngine.search(testFiles, criteria);
    expect(results.length).to.be.greaterThan(0);
  });
});
