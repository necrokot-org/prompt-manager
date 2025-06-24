import * as assert from "assert";

// Simple utility function for testing - no external dependencies
function slugify(text: string, separator: string = "-"): string {
  if (!text || typeof text !== "string") {
    return "";
  }

  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, separator)
    .replace(new RegExp(`^${separator}+|${separator}+$`, "g"), "")
    .replace(new RegExp(`${separator}+`, "g"), separator);
}

suite("String Utils - Unit Tests", () => {
  test("should convert text to slug with default separator", () => {
    const result = slugify("Hello World");
    assert.strictEqual(result, "hello-world");
  });

  test("should convert text to slug with custom separator", () => {
    const result = slugify("Hello World", "_");
    assert.strictEqual(result, "hello_world");
  });

  test("should handle special characters", () => {
    const result = slugify("File@Name#With$Special%Chars");
    assert.strictEqual(result, "file-name-with-special-chars");
  });

  test("should handle empty string", () => {
    const result = slugify("");
    assert.strictEqual(result, "");
  });

  test("should handle whitespace only", () => {
    const result = slugify("   ");
    assert.strictEqual(result, "");
  });

  test("should handle single character", () => {
    const result1 = slugify("a");
    assert.strictEqual(result1, "a");

    const result2 = slugify("@");
    assert.strictEqual(result2, "");
  });

  test("should remove consecutive separators", () => {
    const result = slugify("hello---world", "-");
    assert.strictEqual(result, "hello-world");
  });

  test("should remove leading and trailing separators", () => {
    const result = slugify("---hello-world---");
    assert.strictEqual(result, "hello-world");
  });
});
