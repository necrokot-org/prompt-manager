import { afterEach, beforeEach, describe, it } from "mocha";
import * as assert from "assert";
import * as path from "path";
import * as fs from "fs-extra";
import * as vscode from "vscode";
import * as sinon from "sinon";
import { setupMockWorkspace, MockWorkspaceSetup } from "./helpers";
import { TagService } from "@features/prompt-manager/application/services/TagService";
import { Tag } from "@features/prompt-manager/domain/Tag";
import { FileManager } from "@features/prompt-manager/data/fileManager";
import { container, setupDependencyInjection } from "@infra/di/di-container";
import { DI_TOKENS } from "@infra/di/di-tokens";

describe("Tag Flow Integration Tests", () => {
  let mockWorkspace: MockWorkspaceSetup;
  let tagService: TagService;
  let mockContext: vscode.ExtensionContext;
  let showWarningMessageStub: sinon.SinonStub;
  let showInformationMessageStub: sinon.SinonStub;

  beforeEach(async () => {
    // Clear DI container first to avoid conflicts
    container.clearInstances();

    // Setup test environment
    mockWorkspace = await setupMockWorkspace("tag-test-");

    // Mock vscode dialogs
    showWarningMessageStub = sinon.stub(vscode.window, "showWarningMessage");
    showInformationMessageStub = sinon.stub(
      vscode.window,
      "showInformationMessage"
    );

    // Create mock extension context
    mockContext = {
      subscriptions: [],
      extensionPath: "/mock/path",
      globalState: {
        get: () => undefined,
        update: () => Promise.resolve(),
      },
      workspaceState: {
        get: () => undefined,
        update: () => Promise.resolve(),
      },
    } as any;

    // Setup DI container with mock context
    setupDependencyInjection(mockContext);

    // Get TagService from DI container
    tagService = container.resolve(DI_TOKENS.TagService);
  });

  afterEach(async () => {
    await mockWorkspace.cleanup();
    // Clear DI container to avoid test interference
    container.clearInstances();
    // Restore sinon stubs
    sinon.restore();
  });

  describe("Tag extraction and filtering", () => {
    it("should extract tags from prompt files", async () => {
      // Create a test prompt with tags
      const promptContent = `---
title: Test Prompt
tags: [javascript, react, frontend]
---

# Test Prompt

This is a test prompt with tags.`;

      const promptPath = path.join(
        mockWorkspace.testPromptPath,
        "test-prompt.md"
      );
      await fs.writeFile(promptPath, promptContent);

      // Rebuild index so TagService can find the new files
      const fileManager = container.resolve<FileManager>(DI_TOKENS.FileManager);
      await fileManager.rebuildIndex();

      // Get all tags
      const tags = await tagService.refreshTags();

      assert.ok(tags.length >= 3);
      const tagValues = tags.map((tag) => tag.value);
      assert.ok(tagValues.includes("javascript"));
      assert.ok(tagValues.includes("react"));
      assert.ok(tagValues.includes("frontend"));
    });

    it("should filter prompts by tag", async () => {
      // Create multiple prompts with different tags
      const prompt1Content = `---
title: React Prompt
tags: [javascript, react]
---

# React Component`;

      const prompt2Content = `---
title: Vue Prompt  
tags: [javascript, vue]
---

# Vue Component`;

      await fs.writeFile(
        path.join(mockWorkspace.testPromptPath, "react-prompt.md"),
        prompt1Content
      );
      await fs.writeFile(
        path.join(mockWorkspace.testPromptPath, "vue-prompt.md"),
        prompt2Content
      );

      // Rebuild index so TagService can find the new files
      const fileManager = container.resolve<FileManager>(DI_TOKENS.FileManager);
      await fileManager.rebuildIndex();

      // Select react tag
      const reactTag = Tag.from("react");
      await tagService.selectTag(reactTag);

      // Verify tag is active
      const activeTag = tagService.getActiveTag();
      assert.ok(activeTag);
      assert.strictEqual(activeTag.value, "react");
    });
  });

  describe("Tag management operations", () => {
    it("should rename tags across multiple files", async () => {
      // Configure mock to approve rename operation
      showWarningMessageStub.resolves("Rename");

      // Create prompts with the tag to rename
      const prompt1Content = `---
title: Old Tag Prompt 1
tags: [oldtag, other]
---

# Prompt 1`;

      const prompt2Content = `---
title: Old Tag Prompt 2
tags: [oldtag, another]
---

# Prompt 2`;

      const prompt1Path = path.join(mockWorkspace.testPromptPath, "prompt1.md");
      const prompt2Path = path.join(mockWorkspace.testPromptPath, "prompt2.md");

      await fs.writeFile(prompt1Path, prompt1Content);
      await fs.writeFile(prompt2Path, prompt2Content);

      // Rebuild index so TagService can find the new files
      const fileManager = container.resolve<FileManager>(DI_TOKENS.FileManager);
      await fileManager.rebuildIndex();

      // Rename tag
      const oldTag = Tag.from("oldtag");
      await tagService.renameTag(oldTag, "newtag");

      // Verify files were updated
      const updatedContent1 = await fs.readFile(prompt1Path, "utf8");
      const updatedContent2 = await fs.readFile(prompt2Path, "utf8");

      assert.ok(updatedContent1.includes("newtag"));
      assert.ok(!updatedContent1.includes("oldtag"));
      assert.ok(updatedContent2.includes("newtag"));
      assert.ok(!updatedContent2.includes("oldtag"));
    });

    it("should delete tags from multiple files", async () => {
      // Configure mock to approve delete operation
      showWarningMessageStub.resolves("Delete");

      // Create prompts with the tag to delete
      const promptContent = `---
title: Tagged Prompt
tags: [deleteme, keeper]
---

# Tagged Prompt`;

      const promptPath = path.join(
        mockWorkspace.testPromptPath,
        "tagged-prompt.md"
      );
      await fs.writeFile(promptPath, promptContent);

      // Rebuild index so TagService can find the new files
      const fileManager = container.resolve<FileManager>(DI_TOKENS.FileManager);
      await fileManager.rebuildIndex();

      // Delete tag
      const tagToDelete = Tag.from("deleteme");
      await tagService.deleteTag(tagToDelete);

      // Verify tag was removed
      const updatedContent = await fs.readFile(promptPath, "utf8");
      assert.ok(!updatedContent.includes("deleteme"));
      assert.ok(updatedContent.includes("keeper"));
    });
  });

  describe("Tag state persistence", () => {
    it("should persist active tag in workspace state", async () => {
      const tag = Tag.from("persistent");
      await tagService.selectTag(tag);

      // Verify tag is persisted
      const activeTag = tagService.getActiveTag();
      assert.ok(activeTag);
      assert.strictEqual(activeTag.value, "persistent");
    });

    it("should clear active tag", async () => {
      // Set a tag first
      const tag = Tag.from("temporary");
      await tagService.selectTag(tag);
      assert.ok(tagService.getActiveTag());

      // Clear the tag
      await tagService.clearTagSelection();
      assert.strictEqual(tagService.getActiveTag(), undefined);
    });
  });
});
