import { expect } from "chai";
import * as sinon from "sinon";
import {
  MiniSearchEngine,
  FileContent,
  SearchResult,
} from "@features/search/core/MiniSearchEngine";
import { SearchCriteria } from "@features/search/types/SearchCriteria";

suite("MiniSearchEngine", () => {
  let searchEngine: MiniSearchEngine;
  let mockFiles: FileContent[];

  setup(() => {
    searchEngine = new MiniSearchEngine();

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
      const criteria: SearchCriteria = {
        query: "JavaScript",
        scope: "both",
        caseSensitive: false,
        fuzzy: false,
        isActive: true,
      };

      const results = await searchEngine.search(mockFiles, criteria);

      expect(results.length).to.be.greaterThan(0);
      expect(results.some((r) => r.title === "JavaScript Basics")).to.be.true;
    });

    test("should find fuzzy matches", async () => {
      const criteria: SearchCriteria = {
        query: "javascrpt", // intentional typo
        scope: "both",
        caseSensitive: false,
        fuzzy: true,
        isActive: true,
      };

      const results = await searchEngine.search(mockFiles, criteria);

      expect(results.length).to.be.greaterThan(0);
      expect(results.some((r) => r.title === "JavaScript Basics")).to.be.true;
    });

    test("should not find fuzzy matches when fuzzy=false", async () => {
      const criteria: SearchCriteria = {
        query: "javascrpt", // intentional typo
        scope: "both",
        caseSensitive: false,
        fuzzy: false,
        isActive: true,
      };

      const results = await searchEngine.search(mockFiles, criteria);

      expect(results.length).to.equal(0);
    });
  });

  suite("scope-based search", () => {
    test("should search titles only", async () => {
      const criteria: SearchCriteria = {
        query: "JavaScript",
        scope: "titles",
        caseSensitive: false,
        fuzzy: false,
        isActive: true,
      };

      const results = await searchEngine.search(mockFiles, criteria);

      expect(results.length).to.equal(1);
      expect(results[0].title).to.equal("JavaScript Basics");
    });

    test("should search content only", async () => {
      const criteria: SearchCriteria = {
        query: "versatile",
        scope: "content",
        caseSensitive: false,
        fuzzy: false,
        isActive: true,
      };

      const results = await searchEngine.search(mockFiles, criteria);

      expect(results.length).to.equal(1);
      expect(results[0].title).to.equal("JavaScript Basics");
    });

    test("should search both title and content", async () => {
      const criteria: SearchCriteria = {
        query: "programming",
        scope: "both",
        caseSensitive: false,
        fuzzy: false,
        isActive: true,
      };

      const results = await searchEngine.search(mockFiles, criteria);

      expect(results.length).to.be.greaterThan(1);
      expect(results.some((r) => r.title.includes("JavaScript"))).to.be.true;
      expect(results.some((r) => r.title.includes("Python"))).to.be.true;
    });
  });

  suite("case sensitivity", () => {
    test("should handle case insensitive search", async () => {
      const criteria: SearchCriteria = {
        query: "JAVASCRIPT",
        scope: "both",
        caseSensitive: false,
        fuzzy: false,
        isActive: true,
      };

      const results = await searchEngine.search(mockFiles, criteria);

      expect(results.length).to.be.greaterThan(0);
      expect(results.some((r) => r.title === "JavaScript Basics")).to.be.true;
    });

    test("should handle case sensitive search", async () => {
      const criteria: SearchCriteria = {
        query: "JAVASCRIPT",
        scope: "both",
        caseSensitive: true,
        fuzzy: false,
        isActive: true,
      };

      const results = await searchEngine.search(mockFiles, criteria);

      expect(results.length).to.equal(0);
    });
  });

  suite("result scoring and ranking", () => {
    test("should return results with scores", async () => {
      const criteria: SearchCriteria = {
        query: "programming",
        scope: "both",
        caseSensitive: false,
        fuzzy: false,
        isActive: true,
      };

      const results = await searchEngine.search(mockFiles, criteria);

      expect(results.length).to.be.greaterThan(0);
      results.forEach((result) => {
        expect(result.score).to.be.a("number");
        expect(result.score).to.be.greaterThan(0);
      });
    });

    test("should include match information", async () => {
      const criteria: SearchCriteria = {
        query: "JavaScript",
        scope: "both",
        caseSensitive: false,
        fuzzy: false,
        isActive: true,
      };

      const results = await searchEngine.search(mockFiles, criteria);

      expect(results.length).to.be.greaterThan(0);
      const jsResult = results.find((r) => r.title === "JavaScript Basics");
      expect(jsResult).to.exist;
      expect(jsResult!.matches).to.be.an("array");
      expect(jsResult!.matches.length).to.be.greaterThan(0);
    });
  });

  suite("autocomplete functionality", () => {
    test("should provide autocomplete suggestions", async () => {
      const criteria: SearchCriteria = {
        query: "Java",
        scope: "both",
        caseSensitive: false,
        fuzzy: false,
        maxSuggestions: 5,
        isActive: true,
      };

      const suggestions = await searchEngine.autocomplete(mockFiles, criteria);

      expect(suggestions).to.be.an("array");
      expect(suggestions.length).to.be.greaterThan(0);
      expect(suggestions.length).to.be.lessThanOrEqual(5);
    });

    test("should limit suggestions to maxSuggestions", async () => {
      const criteria: SearchCriteria = {
        query: "p",
        scope: "both",
        caseSensitive: false,
        fuzzy: false,
        maxSuggestions: 3,
        isActive: true,
      };

      const suggestions = await searchEngine.autocomplete(mockFiles, criteria);

      expect(suggestions.length).to.be.lessThanOrEqual(3);
    });
  });

  suite("single file operations", () => {
    test("should search within a single file", async () => {
      const jsFile = mockFiles.find((f) => f.path.includes("javascript"));
      expect(jsFile).to.exist;

      const criteria: SearchCriteria = {
        query: "greetUser",
        scope: "content",
        caseSensitive: false,
        fuzzy: false,
        isActive: true,
      };

      const result = await searchEngine.searchSingle(jsFile!, criteria);

      expect(result).to.exist;
      expect(result!.title).to.equal("JavaScript Basics");
    });

    test("should check if file matches criteria", async () => {
      const jsFile = mockFiles.find((f) => f.path.includes("javascript"));
      const pyFile = mockFiles.find((f) => f.path.includes("python"));

      const criteria: SearchCriteria = {
        query: "JavaScript",
        scope: "content",
        caseSensitive: false,
        fuzzy: false,
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
      const criteria: SearchCriteria = {
        query: "",
        scope: "both",
        caseSensitive: false,
        fuzzy: false,
        isActive: false,
      };

      const results = await searchEngine.search(mockFiles, criteria);
      expect(results.length).to.equal(0);
    });

    test("should handle empty file array", async () => {
      const criteria: SearchCriteria = {
        query: "test",
        scope: "both",
        caseSensitive: false,
        fuzzy: false,
        isActive: true,
      };

      const results = await searchEngine.search([], criteria);
      expect(results.length).to.equal(0);
    });

    test("should handle special characters in search query", async () => {
      const criteria: SearchCriteria = {
        query: "!@#$%^&*()",
        scope: "both",
        caseSensitive: false,
        fuzzy: false,
        isActive: true,
      };

      const results = await searchEngine.search(mockFiles, criteria);
      expect(results.length).to.be.greaterThan(0);
      expect(results.some((r) => r.title.includes("Special Characters"))).to.be
        .true;
    });

    test("should handle unicode characters", async () => {
      const criteria: SearchCriteria = {
        query: "你好世界",
        scope: "both",
        caseSensitive: false,
        fuzzy: false,
        isActive: true,
      };

      const results = await searchEngine.search(mockFiles, criteria);
      expect(results.length).to.be.greaterThan(0);
      expect(results.some((r) => r.title.includes("Special Characters"))).to.be
        .true;
    });
  });

  suite("cache management", () => {
    test("should clear cache successfully", async () => {
      // Test that cache clearing works without errors
      searchEngine.clearCache();

      const criteria: SearchCriteria = {
        query: "test",
        scope: "both",
        caseSensitive: false,
        fuzzy: false,
        isActive: true,
      };

      const results = await searchEngine.search(mockFiles, criteria);
      expect(results).to.be.an("array");
    });

    test("should rebuild index when files change", async () => {
      const initialCriteria: SearchCriteria = {
        query: "newfile",
        scope: "both",
        caseSensitive: false,
        fuzzy: false,
        isActive: true,
      };

      // Search with initial files
      const initialResults = await searchEngine.search(
        mockFiles,
        initialCriteria
      );
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

      // Search again with updated files
      const updatedResults = await searchEngine.search(
        updatedFiles,
        initialCriteria
      );
      expect(updatedResults.length).to.equal(1);
      expect(updatedResults[0].title).to.equal("New File");
    });
  });
});
