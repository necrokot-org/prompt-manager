import * as assert from "assert";
import { normalizeFileName, FileNamingPattern } from "@utils/string";

suite("String Utils - normalizeFileName Tests", () => {
  suite("kebab-case pattern", () => {
    test("should convert simple text to kebab-case", async () => {
      const result = await normalizeFileName("Hello World", "kebab-case");
      assert.strictEqual(result, "hello-world");
    });

    test("should handle multiple spaces", async () => {
      const result = await normalizeFileName(
        "  Hello    World  ",
        "kebab-case"
      );
      assert.strictEqual(result, "hello-world");
    });

    test("should convert mixed case to kebab-case", async () => {
      const result = await normalizeFileName("CamelCaseText", "kebab-case");
      assert.strictEqual(result, "camel-case-text");
    });

    test("should handle special characters", async () => {
      const result = await normalizeFileName(
        "File@Name#With$Special%Chars",
        "kebab-case"
      );
      assert.strictEqual(result, "file-name-with-special-chars");
    });

    test("should handle numbers", async () => {
      const result = await normalizeFileName("File Name 123", "kebab-case");
      assert.strictEqual(result, "file-name-123");
    });

    test("should remove leading and trailing dashes", async () => {
      const result = await normalizeFileName("---File Name---", "kebab-case");
      assert.strictEqual(result, "file-name");
    });

    test("should handle empty string", async () => {
      const result = await normalizeFileName("", "kebab-case");
      assert.strictEqual(result, "");
    });

    test("should handle only special characters", async () => {
      const result = await normalizeFileName("@#$%^&*()", "kebab-case");
      assert.strictEqual(result, "");
    });

    test("should handle existing kebab-case", async () => {
      const result = await normalizeFileName(
        "already-kebab-case",
        "kebab-case"
      );
      assert.strictEqual(result, "already-kebab-case");
    });

    test("should handle unicode characters", async () => {
      const result = await normalizeFileName("café naïve résumé", "kebab-case");
      assert.strictEqual(result, "cafe-naive-resume");
    });
  });

  suite("snake_case pattern", () => {
    test("should convert simple text to snake_case", async () => {
      const result = await normalizeFileName("Hello World", "snake_case");
      assert.strictEqual(result, "hello_world");
    });

    test("should handle multiple spaces", async () => {
      const result = await normalizeFileName(
        "  Hello    World  ",
        "snake_case"
      );
      assert.strictEqual(result, "hello_world");
    });

    test("should convert mixed case to snake_case", async () => {
      const result = await normalizeFileName("CamelCaseText", "snake_case");
      assert.strictEqual(result, "camel_case_text");
    });

    test("should handle special characters", async () => {
      const result = await normalizeFileName(
        "File@Name#With$Special%Chars",
        "snake_case"
      );
      assert.strictEqual(result, "file_name_with_special_chars");
    });

    test("should handle numbers", async () => {
      const result = await normalizeFileName("File Name 123", "snake_case");
      assert.strictEqual(result, "file_name_123");
    });

    test("should remove leading and trailing underscores", async () => {
      const result = await normalizeFileName("___File Name___", "snake_case");
      assert.strictEqual(result, "file_name");
    });

    test("should handle empty string", async () => {
      const result = await normalizeFileName("", "snake_case");
      assert.strictEqual(result, "");
    });

    test("should handle only special characters", async () => {
      const result = await normalizeFileName("@#$%^&*()", "snake_case");
      assert.strictEqual(result, "");
    });

    test("should handle existing snake_case", async () => {
      const result = await normalizeFileName(
        "already_snake_case",
        "snake_case"
      );
      assert.strictEqual(result, "already_snake_case");
    });

    test("should handle unicode characters", async () => {
      const result = await normalizeFileName("café naïve résumé", "snake_case");
      assert.strictEqual(result, "cafe_naive_resume");
    });
  });

  suite("original pattern", () => {
    test("should return original string unchanged", async () => {
      const input = "Hello World!@#$";
      const result = await normalizeFileName(input, "original");
      assert.strictEqual(result, input);
    });

    test("should handle empty string", async () => {
      const result = await normalizeFileName("", "original");
      assert.strictEqual(result, "");
    });

    test("should preserve all characters", async () => {
      const input = "File Name with Spaces & Special Ch@rs 123";
      const result = await normalizeFileName(input, "original");
      assert.strictEqual(result, input);
    });

    test("should preserve unicode characters", async () => {
      const input = "café naïve résumé 🚀";
      const result = await normalizeFileName(input, "original");
      assert.strictEqual(result, input);
    });
  });

  suite("default behavior", () => {
    test("should default to kebab-case when no pattern specified", async () => {
      const result = await normalizeFileName("Hello World");
      assert.strictEqual(result, "hello-world");
    });

    test("should default to kebab-case for invalid pattern", async () => {
      const result = await normalizeFileName(
        "Hello World",
        "invalid" as FileNamingPattern
      );
      assert.strictEqual(result, "hello-world");
    });
  });

  suite("edge cases", () => {
    test("should handle very long strings", async () => {
      const longString = "a".repeat(1000);
      const result = await normalizeFileName(longString, "kebab-case");
      assert.strictEqual(result, longString);
    });

    test("should handle strings with only numbers", async () => {
      const result = await normalizeFileName("123456", "kebab-case");
      assert.strictEqual(result, "123456");
    });

    test("should handle strings with mixed separators", async () => {
      const result = await normalizeFileName(
        "file-name_with.mixed@separators",
        "kebab-case"
      );
      assert.strictEqual(result, "file-name-with-mixed-separators");
    });

    test("should handle consecutive special characters", async () => {
      const result = await normalizeFileName(
        "file@@@name###with$$$specials",
        "snake_case"
      );
      assert.strictEqual(result, "file_name_with_specials");
    });

    test("should handle single character", async () => {
      const result1 = await normalizeFileName("a", "kebab-case");
      assert.strictEqual(result1, "a");

      const result2 = await normalizeFileName("@", "kebab-case");
      assert.strictEqual(result2, "");
    });

    test("should handle whitespace only", async () => {
      const result1 = await normalizeFileName("   ", "kebab-case");
      assert.strictEqual(result1, "");

      const result2 = await normalizeFileName("\t\n\r", "snake_case");
      assert.strictEqual(result2, "");
    });
  });

  suite("real-world scenarios", () => {
    test("should handle typical prompt file names", async () => {
      const testCases = [
        {
          input: "Code Review Helper",
          kebab: "code-review-helper",
          snake: "code_review_helper",
        },
        {
          input: "API Documentation Generator",
          kebab: "api-documentation-generator",
          snake: "api_documentation_generator",
        },
        {
          input: "Bug Report Template",
          kebab: "bug-report-template",
          snake: "bug_report_template",
        },
        {
          input: "SQL Query Builder",
          kebab: "sql-query-builder",
          snake: "sql_query_builder",
        },
        {
          input: "React Component Creator",
          kebab: "react-component-creator",
          snake: "react_component_creator",
        },
      ];

      for (const { input, kebab, snake } of testCases) {
        assert.strictEqual(await normalizeFileName(input, "kebab-case"), kebab);
        assert.strictEqual(await normalizeFileName(input, "snake_case"), snake);
        assert.strictEqual(await normalizeFileName(input, "original"), input);
      }
    });

    test("should handle file names with version numbers", async () => {
      const result1 = await normalizeFileName("API Helper v2.1", "kebab-case");
      assert.strictEqual(result1, "api-helper-v2-1");

      const result2 = await normalizeFileName(
        "Template (v1.0.0)",
        "snake_case"
      );
      assert.strictEqual(result2, "template_v1_0_0");
    });

    test("should handle file names with dates", async () => {
      const result1 = await normalizeFileName(
        "Meeting Notes 2024-01-15",
        "kebab-case"
      );
      assert.strictEqual(result1, "meeting-notes-2024-01-15");

      const result2 = await normalizeFileName(
        "Report_2024/01/15",
        "snake_case"
      );
      assert.strictEqual(result2, "report_2024_01_15");
    });
  });
});
