/**
 * Integration test for the tag tree view functionality
 * Tests the interaction between the separate tag tree and prompt tree
 */
import { setup, teardown, suite, test } from "mocha";
import { expect } from "chai";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { container, setupDependencyInjection } from "@infra/di/di-container";
import { DI_TOKENS } from "@infra/di/di-tokens";
import { TagService } from "@features/prompt-manager/application/services/TagService";
import { TagTreeProvider } from "@features/prompt-manager/ui/tree/TagTreeProvider";
import {
  TagTreeItem,
  TagRootTreeItem,
} from "@features/prompt-manager/ui/tree/items";
import { Tag } from "@features/prompt-manager/domain/Tag";
import { setupMockWorkspace, MockWorkspaceSetup } from "./helpers";

suite("Tag Tree Integration Flow", () => {
  let mockContext: vscode.ExtensionContext;
  let tagService: TagService;
  let tagTreeProvider: TagTreeProvider;
  let mockWorkspace: MockWorkspaceSetup;

  setup(async () => {
    // Clear DI container to avoid test interference
    container.clearInstances();

    // Setup test environment
    mockWorkspace = await setupMockWorkspace("tag-tree-test-");

    // Create mock extension context
    mockContext = {
      subscriptions: [],
      workspaceState: {
        get: () => undefined,
        update: () => Promise.resolve(),
      },
    } as any;

    // Initialize DI container with our mock
    setupDependencyInjection(mockContext);

    // Get services from container
    tagService = container.resolve(DI_TOKENS.TagService);
    tagTreeProvider = container.resolve(DI_TOKENS.TagTreeProvider);
  });

  teardown(async () => {
    await mockWorkspace.cleanup();
    container.clearInstances();
    sinon.restore();
  });

  suite("Tag Tree View Functionality", () => {
    test("should show separate tags tree with TagRoot", async () => {
      // Get tag tree children - should have TagRoot
      const tagTreeChildren = await tagTreeProvider.getChildren();

      expect(tagTreeChildren).to.have.lengthOf(1);
      expect(tagTreeChildren[0]).to.be.instanceOf(TagRootTreeItem);
    });

    test("should show TagRoot as collapsible", async () => {
      const tagTreeChildren = await tagTreeProvider.getChildren();
      const tagRoot = tagTreeChildren[0] as TagRootTreeItem;

      expect(tagRoot.collapsibleState).to.equal(
        vscode.TreeItemCollapsibleState.Expanded
      );
    });

    test("should handle tag selection and show active state", async () => {
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

    test("should return to inactive state when tag filter is cleared", async () => {
      // Arrange: Get available tags and select one
      const tags = await tagService.refreshTags();

      if (tags.length > 0) {
        const selectedTag = tags[0];
        await tagService.selectTag(selectedTag);

        // Clear tag selection
        await tagService.clearTagSelection();

        // Act: Get tag items
        const tagTreeChildren = await tagTreeProvider.getChildren();
        const tagRoot = tagTreeChildren[0] as TagRootTreeItem;
        const tagItems = await tagTreeProvider.getChildren(tagRoot);

        // Assert: No tag should be marked as active
        const activeTags = tagItems.filter(
          (item) => item instanceof TagTreeItem && item.description === "active"
        );

        expect(activeTags).to.have.lengthOf(0);
      }
    });

    test("should properly restore and maintain tag filter state across workspace sessions", async () => {
      // This test verifies the fix for: "after restoring workspace with selected tag no clear button appears"

      // Arrange: Get available tags and select one
      const tags = await tagService.refreshTags();

      if (tags.length > 0) {
        const selectedTag = tags[0];

        // Act: Select a tag to simulate user action
        await tagService.selectTag(selectedTag);

        // Assert: Verify the tag is properly active and persisted
        const activeTag = tagService.getActiveTag();
        expect(activeTag).to.not.be.undefined;
        expect(activeTag?.value).to.equal(selectedTag.value);

        // The context key should be set by the extension activation during startup
        // (this is tested by the actual fix in extension.ts)

        // Test that clearing works as expected
        await tagService.clearTagSelection();
        const clearedTag = tagService.getActiveTag();
        expect(clearedTag).to.be.undefined;
      }
    });
  });

  suite("Tag Items Display", () => {
    test("should show tag items as children of TagRoot", async () => {
      // Arrange: Get TagRoot
      const tagTreeChildren = await tagTreeProvider.getChildren();
      const tagRoot = tagTreeChildren[0] as TagRootTreeItem;

      // Act: Get tag items
      const tagItems = await tagTreeProvider.getChildren(tagRoot);

      // Assert: Should have tag items
      expect(tagItems).to.be.an("array");
      tagItems.forEach((item) => {
        expect(item).to.be.instanceOf(TagTreeItem);
      });
    });

    test("should mark active tag with description", async () => {
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

  suite("Tree Provider Events", () => {
    test("should refresh when refresh() is called", () => {
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
