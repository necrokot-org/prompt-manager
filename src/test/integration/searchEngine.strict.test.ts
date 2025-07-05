import { expect } from "chai";
import {
  FlexSearchService,
  SearchOptions,
} from "@features/search/core/FlexSearchService";
import { FileContent } from "@utils/parsePrompt";

suite("FlexSearchService Case Sensitivity and Scope", () => {
  let searchEngine: FlexSearchService;
  let mockFiles: FileContent[];

  setup(() => {
    searchEngine = new FlexSearchService();

    mockFiles = [
      {
        path: "/test/javascript-basics.md",
        content: `---
title: "JavaScript Basics"
description: "Learn JavaScript fundamentals"
tags: ["javascript", "programming", "basics"]
---
JavaScript is a versatile programming language.`,
      },
      {
        path: "/test/python-guide.md",
        content: `---
title: "Python Guide"
description: "Python programming guide"
tags: ["python", "programming", "guide"]
---
Python programming language guide.`,
      },
    ];
  });

  teardown(() => {
    searchEngine.clearCache();
  });

  test("should handle case sensitive search", async () => {
    await searchEngine.index(mockFiles);

    const options: SearchOptions = {
      query: "JAVASCRIPT",
      fields: ["fileName", "title", "description", "tags", "content"],
      exact: false,
      caseSensitive: true,
      
      suggest: false,
    };

    const results = searchEngine.search(options);
    expect(results.length).to.equal(0);
  });

  test("should handle case insensitive search", async () => {
    await searchEngine.index(mockFiles);

    const options: SearchOptions = {
      query: "JAVASCRIPT",
      fields: ["fileName", "title", "description", "tags", "content"],
      exact: false,
      caseSensitive: false,
      
      suggest: false,
    };

    const results = searchEngine.search(options);
    expect(results.length).to.be.greaterThan(0);
    expect(results.some((r) => r.title === "JavaScript Basics")).to.be.true;
  });
});
