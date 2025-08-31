import { setup, teardown, suite, test } from "mocha";
import { expect } from "chai";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { PromptApp } from "../../application/PromptApp";
import { PromptStore } from "../../application/ports/PromptStore";
import { Indexer } from "../../application/ports/Indexer";
import { FilterCoordinator } from "../../application/filters/FilterCoordinator";
import { PromptStructure } from "../../domain/model/PromptStructure";

suite("PromptApp", () => {
  let promptApp: PromptApp;
  let mockPromptStore: any;
  let mockIndexer: any;
  let mockFilterCoordinator: any;

  setup(() => {
    // Mock dependencies
    mockPromptStore = {
      createPrompt: sinon.stub().resolves("/test/prompt.md"),
      deletePrompt: sinon.stub().resolves(),
      createFolder: sinon.stub().resolves("/test/folder"),
      deleteFolder: sinon.stub().resolves(),
      read: sinon.stub().resolves("test content"),
    };

    mockIndexer = {
      build: sinon.stub().resolves({ folders: [], rootPrompts: [] }),
      rebuild: sinon.stub().resolves(),
      rebuildNow: sinon.stub().resolves(),
      get: sinon.stub().returns({ folders: [], rootPrompts: [] }),
    };

    mockFilterCoordinator = {
      apply: sinon.stub().resolves({ folders: [], rootPrompts: [] }),
    };

    promptApp = new PromptApp(
      mockPromptStore,
      mockIndexer,
      mockFilterCoordinator
    );
  });

  teardown(() => {
    sinon.restore();
  });

  suite("initWorkspace", () => {
    test("should call indexer.build() to initialize workspace", async () => {
      await promptApp.initWorkspace();

      expect(mockIndexer.build.calledOnce).to.be.true;
    });
  });

  suite("structure", () => {
    test("should return filtered structure from indexer and filters", async () => {
      const mockStructure: PromptStructure = {
        folders: [
          {
            name: "Test Folder",
            path: "/test/folder",
            prompts: [],
          },
        ],
        rootPrompts: [
          {
            name: "test.md",
            title: "Test",
            path: "/test/test.md",
            description: "A test",
            tags: ["test"],
            fileSize: 100,
          },
        ],
      };

      const mockFilteredStructure: PromptStructure = {
        folders: [],
        rootPrompts: [mockStructure.rootPrompts[0]],
      };

      mockIndexer.get.returns(mockStructure);
      mockFilterCoordinator.apply.resolves(mockFilteredStructure);

      const result = await promptApp.structure();

      expect(mockIndexer.get.calledOnce).to.be.true;
      expect(mockFilterCoordinator.apply.calledOnce).to.be.true;
      expect(mockFilterCoordinator.apply.calledWith(mockStructure)).to.be.true;
      expect(result).to.equal(mockFilteredStructure);
    });

    test("should call indexer.build() if indexer.get() returns null", async () => {
      const mockStructure: PromptStructure = {
        folders: [],
        rootPrompts: [],
      };

      mockIndexer.get.returns(null);
      mockIndexer.build.resolves(mockStructure);
      mockFilterCoordinator.apply.resolves(mockStructure);

      await promptApp.structure();

      expect(mockIndexer.build.calledOnce).to.be.true;
      expect(mockFilterCoordinator.apply.calledOnce).to.be.true;
    });
  });

  suite("createPrompt", () => {
    test("should call store.createPrompt() and indexer.rebuild()", async () => {
      const result = await promptApp.createPrompt(
        "test prompt",
        "/test/folder"
      );

      expect(mockPromptStore.createPrompt.calledOnce).to.be.true;
      expect(
        mockPromptStore.createPrompt.calledWith("test prompt", "/test/folder")
      ).to.be.true;
      expect(mockIndexer.rebuild.calledOnce).to.be.true;
      expect(result).to.equal("/test/prompt.md");
    });

    test("should fire onTreeChanged event after creating prompt", async () => {
      let eventFired = false;
      const subscription = promptApp.onTreeChanged(() => {
        eventFired = true;
      });

      await promptApp.createPrompt("test");

      expect(eventFired).to.be.true;
      subscription.dispose();
    });
  });

  suite("deletePrompt", () => {
    test("should call store.deletePrompt() and indexer.rebuild()", async () => {
      await promptApp.deletePrompt("/test/prompt.md");

      expect(mockPromptStore.deletePrompt.calledOnce).to.be.true;
      expect(mockPromptStore.deletePrompt.calledWith("/test/prompt.md")).to.be
        .true;
      expect(mockIndexer.rebuild.calledOnce).to.be.true;
    });

    test("should fire onTreeChanged event after deleting prompt", async () => {
      let eventFired = false;
      const subscription = promptApp.onTreeChanged(() => {
        eventFired = true;
      });

      await promptApp.deletePrompt("/test/prompt.md");

      expect(eventFired).to.be.true;
      subscription.dispose();
    });
  });

  suite("createFolder", () => {
    test("should call store.createFolder() and indexer.rebuild()", async () => {
      const result = await promptApp.createFolder(
        "test folder",
        "/test/parent"
      );

      expect(mockPromptStore.createFolder.calledOnce).to.be.true;
      expect(
        mockPromptStore.createFolder.calledWith("test folder", "/test/parent")
      ).to.be.true;
      expect(mockIndexer.rebuild.calledOnce).to.be.true;
      expect(result).to.equal("/test/folder");
    });

    test("should fire onTreeChanged event after creating folder", async () => {
      let eventFired = false;
      const subscription = promptApp.onTreeChanged(() => {
        eventFired = true;
      });

      await promptApp.createFolder("test");

      expect(eventFired).to.be.true;
      subscription.dispose();
    });
  });

  suite("deleteFolder", () => {
    test("should call store.deleteFolder() and indexer.rebuild()", async () => {
      await promptApp.deleteFolder("/test/folder");

      expect(mockPromptStore.deleteFolder.calledOnce).to.be.true;
      expect(mockPromptStore.deleteFolder.calledWith("/test/folder")).to.be
        .true;
      expect(mockIndexer.rebuild.calledOnce).to.be.true;
    });

    test("should fire onTreeChanged event after deleting folder", async () => {
      let eventFired = false;
      const subscription = promptApp.onTreeChanged(() => {
        eventFired = true;
      });

      await promptApp.deleteFolder("/test/folder");

      expect(eventFired).to.be.true;
      subscription.dispose();
    });
  });

  suite("copyContent", () => {
    test("should return raw content when withMeta is true", async () => {
      mockPromptStore.read.resolves("---\ntitle: Test\n---\n\nContent body");

      const result = await promptApp.copyContent("/test/file.md", true);

      expect(result).to.equal("---\ntitle: Test\n---\n\nContent body");
      expect(mockPromptStore.read.calledOnce).to.be.true;
    });

    test("should strip frontmatter when withMeta is false", async () => {
      mockPromptStore.read.resolves(
        "---\ntitle: Test\ntags: [test]\n---\n\nActual content\nMore content"
      );

      const result = await promptApp.copyContent("/test/file.md", false);

      expect(result).to.equal("Actual content\nMore content");
      expect(mockPromptStore.read.calledOnce).to.be.true;
    });

    test("should return full content when no frontmatter is present", async () => {
      mockPromptStore.read.resolves("Just content without frontmatter");

      const result = await promptApp.copyContent("/test/file.md", false);

      expect(result).to.equal("Just content without frontmatter");
    });

    test("should handle content with only frontmatter", async () => {
      mockPromptStore.read.resolves("---\ntitle: Test\n---\n");

      const result = await promptApp.copyContent("/test/file.md", false);

      expect(result).to.equal("");
    });
  });

  suite("Event handling", () => {
    test("should expose onTreeChanged event", () => {
      expect(typeof promptApp.onTreeChanged).to.equal("function");
    });
  });
});
