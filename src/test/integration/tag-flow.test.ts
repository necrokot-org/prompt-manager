/**
 * Integration test for the tag tree view functionality
 * Tests the interaction between the separate tag tree and prompt tree
 */
import * as vscode from "vscode";
import { expect } from "chai";
import { TagTreeProvider } from "@features/prompt-manager/ui/tree/TagTreeProvider";
import { TagService } from "@features/prompt-manager/application/services/TagService";
import { container } from "@infra/di/di-container";
import { DI_TOKENS } from "@infra/di/di-tokens";
import {
  TagRootTreeItem,
  TagTreeItem,
} from "@features/prompt-manager/ui/tree/items";

describe("Tag Tree Integration Flow", () => {
  let tagTreeProvider: TagTreeProvider;
  let tagService: TagService;

  before(async () => {
    // Resolve providers from DI container
    tagTreeProvider = container.resolve<TagTreeProvider>(
      DI_TOKENS.TagTreeProvider
    );
    tagService = container.resolve<TagService>(DI_TOKENS.TagService);
  });

  beforeEach(async () => {
    // Clear any active tag filters before each test
    await tagService.clearTagSelection();
  });

  describe("Tag Tree View Functionality", () => {
    it("should show separate tags tree with TagRoot", async () => {
      // Act: Get root items from tag tree
      const tagTreeChildren = await tagTreeProvider.getChildren();

      // Assert: Should have exactly one TagRoot item
      expect(tagTreeChildren).to.have.length(1);
      expect(tagTreeChildren[0]).to.be.instanceOf(TagRootTreeItem);

      const tagRoot = tagTreeChildren[0] as TagRootTreeItem;
      expect(tagRoot.contextValue).to.equal("tagRoot");
    });

    it("should show TagRoot as collapsible", async () => {
      // Act: Get root items from tag tree
      const tagTreeChildren = await tagTreeProvider.getChildren();

      // Assert: TagRoot should be expandable
      const tagRoot = tagTreeChildren[0] as TagRootTreeItem;
      expect(tagRoot.collapsibleState).to.equal(
        vscode.TreeItemCollapsibleState.Expanded
      );
    });

    it("should handle tag selection and show active state", async () => {
      // Arrange: Get available tags
      const tags = await tagService.refreshTags();

      if (tags.length > 0) {
        const firstTag = tags[0];

        // Act: Select first available tag
        await tagService.selectTag(firstTag);

        // Get tag tree root after filter is applied
        const tagTreeChildren = await tagTreeProvider.getChildren();

        // Assert: TagRoot should show active filter state
        expect(tagTreeChildren).to.have.length(1);
        const tagRoot = tagTreeChildren[0] as TagRootTreeItem;
        expect(tagRoot.contextValue).to.equal("tagRootActive");
        expect(tagRoot.label).to.include(firstTag.value);
      }
    });

    it("should return to inactive state when tag filter is cleared", async () => {
      // Arrange: Select a tag first if available
      const tags = await tagService.refreshTags();
      if (tags.length > 0) {
        await tagService.selectTag(tags[0]);
      }

      // Act: Clear tag filter
      await tagService.clearTagSelection();

      // Assert: Tag tree root should return to inactive state
      const tagTreeChildren = await tagTreeProvider.getChildren();
      const tagRoot = tagTreeChildren[0] as TagRootTreeItem;
      expect(tagRoot.contextValue).to.equal("tagRoot");
      expect(tagRoot.label).to.equal("Tags");
    });
  });

  describe("Tag Items Display", () => {
    it("should show tag items as children of TagRoot", async () => {
      // Act: Get children of TagRoot
      const tagTreeChildren = await tagTreeProvider.getChildren();
      const tagRoot = tagTreeChildren[0] as TagRootTreeItem;
      const tagItems = await tagTreeProvider.getChildren(tagRoot);

      // Assert: All children should be TagTreeItem instances
      tagItems.forEach((item) => {
        expect(item).to.be.instanceOf(TagTreeItem);
      });
    });

    it("should mark active tag with description", async () => {
      // Arrange: Get available tags and select one
      const tags = await tagService.refreshTags();

      if (tags.length > 0) {
        const selectedTag = tags[0];
        await tagService.selectTag(selectedTag);

        // Act: Get tag items
        const tagTreeChildren = await tagTreeProvider.getChildren();
        const tagRoot = tagTreeChildren[0] as TagRootTreeItem;
        const tagItems = await tagTreeProvider.getChildren(tagRoot);

        // Assert: Selected tag should be marked as active
        const activeTag = tagItems.find(
          (item) =>
            item instanceof TagTreeItem && item.tag.value === selectedTag.value
        ) as TagTreeItem;

        if (activeTag) {
          expect(activeTag.description).to.equal("active");
        }
      }
    });
  });

  describe("Tree Provider Events", () => {
    it("should refresh when refresh() is called", () => {
      // Arrange: Set up event listener
      let eventFired = false;
      const subscription = tagTreeProvider.onDidChangeTreeData(() => {
        eventFired = true;
      });

      // Act: Call refresh
      tagTreeProvider.refresh();

      // Assert: Event should fire
      expect(eventFired).to.be.true;

      // Cleanup
      subscription.dispose();
    });
  });
});
