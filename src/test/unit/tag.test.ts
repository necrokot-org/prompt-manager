import * as assert from "assert";
import { Tag } from "../../domain/model/Tag";

suite("Tag - Unit Tests", () => {
  suite("constructor", () => {
    test("should create tag with lowercase value", () => {
      const tag = new Tag("JAVASCRIPT");
      assert.strictEqual(tag.value, "javascript");
    });

    test("should trim whitespace", () => {
      const tag = new Tag("  react  ");
      assert.strictEqual(tag.value, "react");
    });

    test("should throw error for empty tag", () => {
      assert.throws(() => new Tag(""), /Tag cannot be empty/);
      assert.throws(() => new Tag("   "), /Tag cannot be empty/);
    });

    test("should throw error for tag too long", () => {
      const longTag = "a".repeat(51);
      assert.throws(() => new Tag(longTag), /Tag is too long/);
    });
  });

  suite("equals", () => {
    test("should return true for equal tags", () => {
      const tag1 = Tag.from("javascript");
      const tag2 = Tag.from("JAVASCRIPT");
      assert.strictEqual(tag1.equals(tag2), true);
    });

    test("should return false for different tags", () => {
      const tag1 = Tag.from("javascript");
      const tag2 = Tag.from("typescript");
      assert.strictEqual(tag1.equals(tag2), false);
    });
  });

  suite("toString", () => {
    test("should return the tag value", () => {
      const tag = Tag.from("react");
      assert.strictEqual(tag.toString(), "react");
    });
  });

  suite("from", () => {
    test("should create tag from string", () => {
      const tag = Tag.from("Vue");
      assert.strictEqual(tag.value, "vue");
    });
  });

  suite("fromArray", () => {
    test("should create tags from array", () => {
      const tags = Tag.fromArray(["React", "Vue", "Angular"]);
      assert.strictEqual(tags.length, 3);
      assert.deepStrictEqual(
        tags.map((t) => t.value),
        ["react", "vue", "angular"]
      );
    });

    test("should filter out empty values", () => {
      const tags = Tag.fromArray(["React", "", "  ", "Vue"]);
      assert.strictEqual(tags.length, 2);
      assert.deepStrictEqual(
        tags.map((t) => t.value),
        ["react", "vue"]
      );
    });
  });
});
