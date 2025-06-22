import { afterEach, beforeEach, describe, it } from "mocha";
import { expect } from "chai";
import * as sinon from "sinon";
import { SearchEngine, SearchCriteria, FileContent, SearchResult } from "@features/search/core/SearchEngine";

describe("SearchEngine", () => {
  let searchEngine: SearchEngine;
  let mockFiles: FileContent[];

  beforeEach(() => {
    searchEngine = new SearchEngine();
    
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

JavaScript is a versatile programming language.`
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

Python offers powerful metaprogramming capabilities.`
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

Design systems ensure consistency across products.`
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

The API follows REST conventions.`
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

Testing search functionality with edge cases.`
      }
    ];
  });

  afterEach(() => {
    searchEngine.clearCache();
    sinon.restore();
  });

  describe("exact vs fuzzy matching", () => {
    it("should find exact matches with exact=true", async () => {
      const criteria: SearchCriteria = {
        query: "JavaScript",
        scope: "both",
        exact: true,
        isActive: true
      };

      const results = await searchEngine.search(mockFiles, criteria);

      expect(results).to.have.lengthOf(1);
      expect(results[0].title).to.equal("JavaScript Basics");
      expect(results[0].score).to.be.greaterThan(0.9);
    });

    it("should find fuzzy matches with exact=false", async () => {
      const criteria: SearchCriteria = {
        query: "javascrpt", // intentional typo
        scope: "both",
        exact: false,
        threshold: 0.6,
        isActive: true
      };

      const results = await searchEngine.search(mockFiles, criteria);

      expect(results).to.have.lengthOf.greaterThan(0);
      expect(results.some(r => r.title === "JavaScript Basics")).to.be.true;
    });

    it("should not find fuzzy matches when exact=true", async () => {
      const criteria: SearchCriteria = {
        query: "javascrpt", // intentional typo
        scope: "both",
        exact: true,
        isActive: true
      };

      const results = await searchEngine.search(mockFiles, criteria);

      expect(results).to.have.lengthOf(0);
    });
  });

  describe("threshold configuration", () => {
    it("should respect permissive threshold (0.1)", async () => {
      const criteria: SearchCriteria = {
        query: "design",
        scope: "both",
        threshold: 0.1, // Very permissive
        isActive: true
      };

      const results = await searchEngine.search(mockFiles, criteria);

      expect(results.length).to.be.greaterThan(0);
      expect(results.some(r => r.title.includes("Design"))).to.be.true;
    });

    it("should respect strict threshold (0.9)", async () => {
      const criteria: SearchCriteria = {
        query: "design",
        scope: "both", 
        threshold: 0.9, // Very strict
        isActive: true
      };

      const results = await searchEngine.search(mockFiles, criteria);

      // With very strict threshold, should only find very close matches
      expect(results.every(r => r.score > 0.1)).to.be.true;
    });

    it("should use default threshold when not specified", async () => {
      const criteria: SearchCriteria = {
        query: "programming",
        scope: "both",
        isActive: true
        // threshold not specified, should use default 0.3
      };

      const results = await searchEngine.search(mockFiles, criteria);

      expect(results.length).to.be.greaterThan(0);
      expect(results.some(r => r.title.includes("JavaScript") || r.title.includes("Python"))).to.be.true;
    });
  });

  describe("case sensitivity", () => {
    it("should be case insensitive by default", async () => {
      const criteria: SearchCriteria = {
        query: "JAVASCRIPT",
        scope: "both",
        caseSensitive: false,
        isActive: true
      };

      const results = await searchEngine.search(mockFiles, criteria);

      expect(results).to.have.lengthOf.greaterThan(0);
      expect(results.some(r => r.title === "JavaScript Basics")).to.be.true;
    });

    it("should respect case sensitivity when enabled", async () => {
      const criteria: SearchCriteria = {
        query: "JAVASCRIPT",
        scope: "both",
        caseSensitive: true,
        isActive: true
      };

      const results = await searchEngine.search(mockFiles, criteria);

      // Should not find "JavaScript" when looking for "JAVASCRIPT" with case sensitivity
      expect(results.every(r => !r.title.includes("JavaScript"))).to.be.true;
    });

    it("should find exact case matches when case sensitive", async () => {
      const criteria: SearchCriteria = {
        query: "JavaScript",
        scope: "both",
        caseSensitive: true,
        isActive: true
      };

      const results = await searchEngine.search(mockFiles, criteria);

      expect(results).to.have.lengthOf.greaterThan(0);
      expect(results.some(r => r.title === "JavaScript Basics")).to.be.true;
    });
  });

  describe("search scope filtering", () => {
    it("should search titles only when scope='titles'", async () => {
      const criteria: SearchCriteria = {
        query: "fundamentals", // This word appears in description, not title
        scope: "titles",
        isActive: true
      };

      const results = await searchEngine.search(mockFiles, criteria);

      expect(results).to.have.lengthOf(0);
    });

    it("should search content only when scope='content'", async () => {
      const criteria: SearchCriteria = {
        query: "JavaScript Basics", // This is the title
        scope: "content",
        isActive: true
      };

      const results = await searchEngine.search(mockFiles, criteria);

      // Should find it in content since title is also in content
      expect(results.length).to.be.greaterThan(0);
    });

    it("should search both title and content when scope='both'", async () => {
      const criteria: SearchCriteria = {
        query: "design",
        scope: "both",
        isActive: true
      };

      const results = await searchEngine.search(mockFiles, criteria);

      expect(results).to.have.lengthOf.greaterThan(0);
      expect(results.some(r => r.title.includes("Design"))).to.be.true;
    });
  });

  describe("score ordering and ranking", () => {
    it("should return results ordered by relevance score", async () => {
      const criteria: SearchCriteria = {
        query: "programming",
        scope: "both",
        isActive: true
      };

      const results = await searchEngine.search(mockFiles, criteria);

      expect(results.length).to.be.greaterThan(1);

      // Results should be ordered by score (descending)
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].score).to.be.greaterThanOrEqual(results[i + 1].score);
      }
    });

    it("should prioritize title matches over content matches", async () => {
      const criteria: SearchCriteria = {
        query: "Advanced",
        scope: "both",
        isActive: true
      };

      const results = await searchEngine.search(mockFiles, criteria);

      expect(results.length).to.be.greaterThan(0);
      
      // Find the result with "Advanced" in title
      const titleMatch = results.find(r => r.title.includes("Advanced"));
      expect(titleMatch).to.exist;
      
      if (results.length > 1) {
        // Title match should have higher score than content-only matches
        const contentOnlyMatches = results.filter(r => !r.title.includes("Advanced"));
        if (contentOnlyMatches.length > 0) {
          expect(titleMatch!.score).to.be.greaterThan(contentOnlyMatches[0].score);
        }
      }
    });

    it("should handle score conversion from fuse.js properly", async () => {
      const criteria: SearchCriteria = {
        query: "JavaScript",
        scope: "both",
        exact: true,
        isActive: true
      };

      const results = await searchEngine.search(mockFiles, criteria);

      expect(results.length).to.be.greaterThan(0);
      
      // Scores should be between 0 and 1 (converted from fuse.js)
      results.forEach(result => {
        expect(result.score).to.be.at.least(0);
        expect(result.score).to.be.at.most(1);
      });
    });
  });

  describe("snippet extraction", () => {
    it("should extract meaningful snippets from matches", async () => {
      const criteria: SearchCriteria = {
        query: "greetUser",
        scope: "content",
        isActive: true
      };

      const results = await searchEngine.search(mockFiles, criteria);

      expect(results.length).to.be.greaterThan(0);
      
      const result = results[0];
      expect(result.snippet).to.exist;
      expect(result.snippet).to.be.a("string");
      expect(result.snippet!.length).to.be.greaterThan(0);
    });

    it("should provide context around matched terms", async () => {
      const criteria: SearchCriteria = {
        query: "metaprogramming",
        scope: "content",
        isActive: true
      };

      const results = await searchEngine.search(mockFiles, criteria);

      expect(results.length).to.be.greaterThan(0);
      
      const result = results[0];
      expect(result.snippet).to.exist;
      expect(result.snippet).to.include("metaprogramming");
      
      // Should include context around the match
      expect(result.snippet!.length).to.be.greaterThan("metaprogramming".length);
    });

    it("should handle multiple matches in snippet", async () => {
      const criteria: SearchCriteria = {
        query: "JavaScript",
        scope: "both",
        isActive: true
      };

      const results = await searchEngine.search(mockFiles, criteria);

      expect(results.length).to.be.greaterThan(0);
      
      const jsResult = results.find(r => r.title === "JavaScript Basics");
      expect(jsResult).to.exist;
      expect(jsResult!.matches.length).to.be.greaterThan(0);
      
      // Should have match information
      jsResult!.matches.forEach(match => {
        expect(match.type).to.be.oneOf(["title", "content", "description", "tags"]);
        expect(match.position).to.be.a("number");
        expect(match.length).to.be.a("number");
        expect(match.context).to.be.a("string");
      });
    });
  });

  describe("special characters and unicode", () => {
    it("should handle special characters in search query", async () => {
      const criteria: SearchCriteria = {
        query: "@#$%",
        scope: "content",
        isActive: true
      };

      const results = await searchEngine.search(mockFiles, criteria);

      expect(results.length).to.be.greaterThan(0);
      expect(results.some(r => r.title.includes("Special Characters"))).to.be.true;
    });

    it("should handle unicode characters", async () => {
      const criteria: SearchCriteria = {
        query: "你好世界",
        scope: "content",
        isActive: true
      };

      const results = await searchEngine.search(mockFiles, criteria);

      expect(results.length).to.be.greaterThan(0);
      expect(results.some(r => r.title.includes("Special Characters"))).to.be.true;
    });
  });

  describe("search engine utilities", () => {
    it("should return correct count of matches", async () => {
      const criteria: SearchCriteria = {
        query: "programming",
        scope: "both",
        isActive: true
      };

      const count = await searchEngine.count(mockFiles, criteria);
      const results = await searchEngine.search(mockFiles, criteria);

      expect(count).to.equal(results.length);
    });

    it("should check if single file matches criteria", async () => {
      const criteria: SearchCriteria = {
        query: "JavaScript",
        scope: "both",
        isActive: true
      };

      const jsFile = mockFiles.find(f => f.path.includes("javascript"));
      const pyFile = mockFiles.find(f => f.path.includes("python"));

      expect(jsFile).to.exist;
      expect(pyFile).to.exist;

      const jsMatches = await searchEngine.matches(jsFile!, criteria);
      const pyMatches = await searchEngine.matches(pyFile!, criteria);

      expect(jsMatches).to.be.true;
      expect(pyMatches).to.be.false;
    });

    it("should search within single file", async () => {
      const criteria: SearchCriteria = {
        query: "decorators",
        scope: "content",
        isActive: true
      };

      const pyFile = mockFiles.find(f => f.path.includes("python"));
      expect(pyFile).to.exist;

      const result = await searchEngine.searchSingle(pyFile!, criteria);

      expect(result).to.not.be.null;
      expect(result!.title).to.equal("Advanced Python Techniques");
      expect(result!.matches.length).to.be.greaterThan(0);
    });

    it("should return available search scopes", () => {
      const scopes = searchEngine.getAvailableScopes();

      expect(scopes).to.include.members(["titles", "content", "both"]);
      expect(scopes).to.have.lengthOf(3);
    });
  });

  describe("inactive search handling", () => {
    it("should return empty results when search is inactive", async () => {
      const criteria: SearchCriteria = {
        query: "JavaScript",
        scope: "both",
        isActive: false // Inactive search
      };

      const results = await searchEngine.search(mockFiles, criteria);

      expect(results).to.have.lengthOf(0);
    });

    it("should return false for matches when search is inactive", async () => {
      const criteria: SearchCriteria = {
        query: "JavaScript", 
        scope: "both",
        isActive: false
      };

      const jsFile = mockFiles[0];
      const matches = await searchEngine.matches(jsFile, criteria);

      expect(matches).to.be.false;
    });

    it("should return 0 count when search is inactive", async () => {
      const criteria: SearchCriteria = {
        query: "JavaScript",
        scope: "both",
        isActive: false
      };

      const count = await searchEngine.count(mockFiles, criteria);

      expect(count).to.equal(0);
    });
  });

  describe("empty and edge cases", () => {
    it("should handle empty query", async () => {
      const criteria: SearchCriteria = {
        query: "",
        scope: "both",
        isActive: true
      };

      const results = await searchEngine.search(mockFiles, criteria);

      expect(results).to.have.lengthOf(0);
    });

    it("should handle whitespace-only query", async () => {
      const criteria: SearchCriteria = {
        query: "   \t\n   ",
        scope: "both",
        isActive: true
      };

      const results = await searchEngine.search(mockFiles, criteria);

      expect(results).to.have.lengthOf(0);
    });

    it("should handle empty file list", async () => {
      const criteria: SearchCriteria = {
        query: "JavaScript",
        scope: "both",
        isActive: true
      };

      const results = await searchEngine.search([], criteria);

      expect(results).to.have.lengthOf(0);
    });
  });
}); 