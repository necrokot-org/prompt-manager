import { expect } from "chai";
import {
  FlexSearchService,
  SearchOptions,
} from "@features/search/core/FlexSearchService";
import { FileContent } from "@utils/parsePrompt";

suite("FlexSearchService Basic Queries", () => {
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
        path: "/test/advanced-javascript.md",
        content: `---
title: "Advanced JavaScript"
description: "Advanced JavaScript concepts"
tags: ["javascript", "advanced", "programming"]
---
Advanced JavaScript concepts and patterns.`,
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

  test("should find files with basic boolean query", async () => {
    await searchEngine.index(mockFiles);

    const options: SearchOptions = {
      query: "JavaScript",
      fields: ["fileName", "title", "description", "tags", "content"],
      exact: false,
      caseSensitive: false,
      
      suggest: false,
    };

    const results = searchEngine.search(options);
    expect(results.length).to.be.greaterThan(0);
    expect(results.some((r) => r.title === "JavaScript Basics")).to.be.true;
    expect(results.some((r) => r.title === "Advanced JavaScript")).to.be.true;
  });
});
