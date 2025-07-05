import { expect } from "chai";
import * as sinon from "sinon";
import {
  FlexSearchService,
  SearchOptions,
  SearchScope,
} from "@features/search/core/FlexSearchService";
import { FileContent } from "@utils/parsePrompt";
import { SearchCriteria } from "@features/search/types/SearchCriteria";

suite("FlexSearchService", () => {
  let searchEngine: FlexSearchService;
  let mockFiles: FileContent[];

  setup(() => {
    searchEngine = new FlexSearchService();

    // Create mock files with various content types for testing
    mockFiles = [
      {
        path: "/test/javascript-basics.md",
        content: `---
title: "JavaScript Basics"
description: "Learn JavaScript fundamentals"
tags: ["javascript", "programming", "basics"]
category: "development"
---

# JavaScript Basics

This guide covers the fundamentals of JavaScript programming.

## Variables and Functions

\`\`\`javascript
function greetUser(name) {
    return "Hello, " + name + "!";
}

const userName = "Alice";
console.log(greetUser(userName));
\`\`\`

JavaScript is a versatile programming language.`,
      },
      {
        path: "/test/python-advanced.md",
        content: `---
title: "Advanced Python Techniques"
description: "Advanced Python programming concepts"
tags: ["python", "programming", "advanced"]
category: "development"
---

# Advanced Python Techniques

Explore advanced Python programming patterns.

## Decorators and Context Managers

\`\`\`python
def timer_decorator(func):
    import time
    def wrapper(*args, **kwargs):
        start = time.time()
        result = func(*args, **kwargs)
        print(f"Execution time: {time.time() - start}")
        return result
    return wrapper
\`\`\`

Python offers powerful metaprogramming capabilities.`,
      },
      {
        path: "/test/design-systems.md",
        content: `---
title: "Design System Guidelines"
description: "UI/UX design system documentation"
tags: ["design", "ui", "ux", "system"]
category: "design"
---

# Design System Guidelines

Creating consistent user interfaces.

## Color Palette

- Primary: #007ACC
- Secondary: #FF6B35
- Neutral: #F5F5F5

Design systems ensure consistency across products.`,
      },
      {
        path: "/test/api-documentation.md",
        content: `---
title: "REST API Documentation"
description: "Complete API reference guide"
tags: ["api", "rest", "documentation"]
category: "backend"
---

# REST API Documentation

Complete reference for our REST API endpoints.

## Authentication

All API requests require authentication via API key.

\`\`\`javascript
fetch('/api/users', {
    headers: {
        'Authorization': 'Bearer YOUR_API_KEY'
    }
});
\`\`\`

The API follows REST conventions.`,
      },
      {
        path: "/test/special-chars.md",
        content: `---
title: "Special Characters & Symbols"
description: "Testing with special chars: @#$%^&*()"
tags: ["special", "unicode", "testing"]
---

# Special Characters Test

Content with special characters: !@#$%^&*()
Unicode symbols: 你好世界 🚀 🔍 ✨
RegExp patterns: [.*+?^{}$()|[]\\]

Testing search functionality with edge cases.`,
      },
    ];
  });

  teardown(() => {
    searchEngine.clearCache();
    sinon.restore();
  });

  suite("basic search functionality", () => {
    test("should find exact matches", async () => {
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
    });

    test("should find fuzzy matches", async () => {
      await searchEngine.index(mockFiles);

      const options: SearchOptions = {
        query: "JavaScri", // prefix match that FlexSearch can handle
        scope: SearchScope.ALL,
        exact: false,
        caseSensitive: false,
        fuzzy: { enabled: true, distance: 3 },
        suggest: false,
      };

      const results = searchEngine.search(options);

      expect(results.length).to.be.greaterThan(0);
      expect(results.some((r) => r.title === "JavaScript Basics")).to.be.true;
    });

    test("should not find fuzzy matches when fuzzy=false", async () => {
      await searchEngine.index(mockFiles);

      const options: SearchOptions = {
        query: "javascrpt", // intentional typo
        fields: ["fileName", "title", "description", "tags", "content"],
        exact: false,
        caseSensitive: false,
        suggest: false,
      };

      const results = searchEngine.search(options);

      expect(results.length).to.equal(0);
    });
  });

  suite("scope-based search", () => {
    test("should search titles only", async () => {
      await searchEngine.index(mockFiles);

      const options: SearchOptions = {
        query: "JavaScript",
        fields: ["title", "fileName"],
        exact: false,
        caseSensitive: false,
        suggest: false,
      };

      const results = searchEngine.search(options);

      expect(results.length).to.equal(1);
      expect(results[0].title).to.equal("JavaScript Basics");
    });

    test("should search content only", async () => {
      await searchEngine.index(mockFiles);

      const options: SearchOptions = {
        query: "versatile",
        fields: ["content", "description"],
        exact: false,
        caseSensitive: false,

        suggest: false,
      };

      const results = searchEngine.search(options);

      expect(results.length).to.equal(1);
      expect(results[0].title).to.equal("JavaScript Basics");
    });

    test("should search both title and content", async () => {
      await searchEngine.index(mockFiles);

      const options: SearchOptions = {
        query: "programming",
        fields: ["fileName", "title", "description", "tags", "content"],
        exact: false,
        caseSensitive: false,

        suggest: false,
      };

      const results = searchEngine.search(options);

      expect(results.length).to.be.greaterThan(1);
      expect(results.some((r) => r.title.includes("JavaScript"))).to.be.true;
      expect(results.some((r) => r.title.includes("Python"))).to.be.true;
    });
  });

  suite("case sensitivity", () => {
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
  });

  suite("result scoring and ranking", () => {
    test("should return results with scores", async () => {
      await searchEngine.index(mockFiles);

      const options: SearchOptions = {
        query: "programming",
        fields: ["fileName", "title", "description", "tags", "content"],
        exact: false,
        caseSensitive: false,

        suggest: false,
      };

      const results = searchEngine.search(options);

      expect(results.length).to.be.greaterThan(0);
      results.forEach((result) => {
        expect(result.score).to.be.a("number");
        expect(result.score).to.be.greaterThan(0);
      });
    });

    test("should include match information", async () => {
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
      const jsResult = results.find((r) => r.title === "JavaScript Basics");
      expect(jsResult).to.exist;
      expect(jsResult!.matches).to.be.an("object");
      expect(Object.keys(jsResult!.matches).length).to.be.greaterThan(0);
    });
  });

  suite("autocomplete functionality", () => {
    test("should provide autocomplete suggestions", async () => {
      await searchEngine.index(mockFiles);

      const options: SearchOptions = {
        query: "Java",
        fields: ["fileName", "title", "description", "tags", "content"],
        limit: 5,
        exact: false,
        caseSensitive: false,

        suggest: true,
      };

      const suggestions = searchEngine.search(options);

      expect(suggestions).to.be.an("array");
      expect(suggestions.length).to.be.greaterThan(0);
      expect(suggestions.length).to.be.lessThanOrEqual(5);
    });

    test("should limit suggestions to maxSuggestions", async () => {
      await searchEngine.index(mockFiles);

      const options: SearchOptions = {
        query: "p",
        fields: ["fileName", "title", "description", "tags", "content"],
        limit: 3,
        exact: false,
        caseSensitive: false,

        suggest: true,
      };

      const suggestions = searchEngine.search(options);

      expect(suggestions.length).to.be.lessThanOrEqual(3);
    });
  });

  suite("single file operations", () => {
    test("should check if file matches criteria", async () => {
      const jsFile = mockFiles.find((f) => f.path.includes("javascript"));
      const pyFile = mockFiles.find((f) => f.path.includes("python"));

      const criteria: SearchCriteria = {
        query: "JavaScript",
        scope: SearchScope.CONTENT,
        caseSensitive: false,

        isActive: true,
      };

      const jsMatches = await searchEngine.matches(jsFile!, criteria);
      const pyMatches = await searchEngine.matches(pyFile!, criteria);

      expect(jsMatches).to.be.true;
      expect(pyMatches).to.be.false;
    });
  });

  suite("edge cases and error handling", () => {
    test("should handle empty query gracefully", async () => {
      await searchEngine.index(mockFiles);

      const options: SearchOptions = {
        query: "",
        fields: ["fileName", "title", "description", "tags", "content"],
        exact: false,
        caseSensitive: false,

        suggest: false,
      };

      const results = searchEngine.search(options);
      expect(results.length).to.equal(0);
    });

    test("should handle empty file array", async () => {
      await searchEngine.index([]);

      const options: SearchOptions = {
        query: "test",
        fields: ["fileName", "title", "description", "tags", "content"],
        exact: false,
        caseSensitive: false,

        suggest: false,
      };

      const results = searchEngine.search(options);
      expect(results.length).to.equal(0);
    });

    test("should handle special characters in search query", async () => {
      await searchEngine.index(mockFiles);

      const options: SearchOptions = {
        query: "!@#$%^&*()",
        fields: ["fileName", "title", "description", "tags", "content"],
        exact: false,
        caseSensitive: false,

        suggest: false,
      };

      const results = searchEngine.search(options);
      expect(results.length).to.be.greaterThan(0);
      expect(results.some((r) => r.title.includes("Special Characters"))).to.be
        .true;
    });

    test("should handle unicode characters", async () => {
      await searchEngine.index(mockFiles);

      const options: SearchOptions = {
        query: "你好世界",
        fields: ["fileName", "title", "description", "tags", "content"],
        exact: false,
        caseSensitive: false,

        suggest: false,
      };

      const results = searchEngine.search(options);
      expect(results.length).to.be.greaterThan(0);
      expect(results.some((r) => r.title.includes("Special Characters"))).to.be
        .true;
    });
  });

  suite("cache management", () => {
    test("should clear cache successfully", async () => {
      // Test that cache clearing works without errors
      searchEngine.clearCache();

      await searchEngine.index(mockFiles);

      const options: SearchOptions = {
        query: "test",
        fields: ["fileName", "title", "description", "tags", "content"],
        exact: false,
        caseSensitive: false,

        suggest: false,
      };

      const results = searchEngine.search(options);
      expect(results).to.be.an("array");
    });

    test("should rebuild index when files change", async () => {
      // Search with initial files
      await searchEngine.index(mockFiles);

      const initialOptions: SearchOptions = {
        query: "newfile",
        fields: ["fileName", "title", "description", "tags", "content"],
        exact: false,
        caseSensitive: false,

        suggest: false,
      };

      const initialResults = searchEngine.search(initialOptions);
      expect(initialResults.length).to.equal(0);

      // Add a new file
      const newFile: FileContent = {
        path: "/test/newfile.md",
        content: `---
title: "New File"
---
This is a newfile for testing.`,
      };

      const updatedFiles = [...mockFiles, newFile];

      // Clear cache to rebuild index with updated files
      searchEngine.clearCache();
      await searchEngine.index(updatedFiles);

      // Search again with updated files
      const updatedResults = searchEngine.search(initialOptions);
      expect(updatedResults.length).to.equal(1);
      expect(updatedResults[0].title).to.equal("New File");
    });
  });
});
