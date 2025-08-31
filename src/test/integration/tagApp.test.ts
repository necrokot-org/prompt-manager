import { setup, teardown, suite, test } from "mocha";
import { expect } from "chai";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { TagApp } from "../../application/TagApp";
import { Tag } from "../../domain/model/Tag";
import { PromptApp } from "../../application/PromptApp";
import { TagPromptFilter } from "../../application/filters/TagPromptFilter";
import { Indexer } from "../../application/ports/Indexer";
import { PromptStructure } from "../../domain/model/PromptStructure";

suite("TagApp", () => {
  let tagApp: TagApp;
  let mockPromptApp: sinon.SinonStubbedInstance<PromptApp>;
  let mockTagFilter: any;
  let mockIndexer: any;

  setup(() => {
    // Mock dependencies
    mockPromptApp = {
      structure: sinon.stub().resolves({ folders: [], rootPrompts: [] }),
      onTreeChanged: new vscode.EventEmitter<void>().event,
      _onTreeChanged: new vscode.EventEmitter<void>(),
    } as any;

    mockTagFilter = {
      setActiveTag: sinon.stub(),
    };

    mockIndexer = {
      build: sinon.stub().resolves({ folders: [], rootPrompts: [] }),
      get: sinon.stub().returns({ folders: [], rootPrompts: [] }),
    };

    tagApp = new TagApp(mockPromptApp, mockTagFilter, mockIndexer);
  });

  teardown(() => {
    sinon.restore();
  });

  suite("list", () => {
    test("should collect unique tags from prompt structure", async () => {
      const mockStructure: PromptStructure = {
        folders: [
          {
            name: "Folder1",
            path: "/test/folder1",
            prompts: [
              {
                name: "prompt1.md",
                title: "Prompt 1",
                path: "/test/folder1/prompt1.md",
                description: "Test",
                tags: ["javascript", "react"],
                fileSize: 100,
              },
            ],
          },
        ],
        rootPrompts: [
          {
            name: "prompt2.md",
            title: "Prompt 2",
            path: "/test/prompt2.md",
            description: "Test",
            tags: ["react", "vue"],
            fileSize: 100,
          },
        ],
      };

      mockIndexer.get.returns(mockStructure);

      const tags = await tagApp.list();

      expect(tags).to.have.lengthOf(3);
      const tagValues = tags.map((t) => t.value).sort();
      expect(tagValues).to.deep.equal(["javascript", "react", "vue"]);
    });

    test("should return empty array when no tags exist", async () => {
      const mockStructure: PromptStructure = {
        folders: [],
        rootPrompts: [
          {
            name: "prompt.md",
            title: "Prompt",
            path: "/test/prompt.md",
            description: "Test",
            tags: [],
            fileSize: 100,
          },
        ],
      };

      mockIndexer.get.returns(mockStructure);

      const tags = await tagApp.list();

      expect(tags).to.be.an("array").that.is.empty;
    });

    test("should call indexer.build() if indexer.get() returns null", async () => {
      const mockStructure: PromptStructure = {
        folders: [],
        rootPrompts: [
          {
            name: "prompt.md",
            title: "Prompt",
            path: "/test/prompt.md",
            description: "Test",
            tags: ["test"],
            fileSize: 100,
          },
        ],
      };

      mockIndexer.get.returns(null);
      mockIndexer.build.resolves(mockStructure);

      await tagApp.list();

      expect(mockIndexer.build.calledOnce).to.be.true;
    });
  });

  suite("select", () => {
    test("should set active tag and update filter", () => {
      const testTag = Tag.from("test");

      tagApp.select(testTag);

      expect(mockTagFilter.setActiveTag.calledOnce).to.be.true;
      expect(mockTagFilter.setActiveTag.calledWith(testTag)).to.be.true;
      expect(tagApp.getActiveTag()).to.equal(testTag);
    });

    test("should fire onTagsChanged event", () => {
      let eventFired = false;
      const subscription = tagApp.onTagsChanged(() => {
        eventFired = true;
      });

      const testTag = Tag.from("test");
      tagApp.select(testTag);

      expect(eventFired).to.be.true;
      subscription.dispose();
    });
  });

  suite("clear", () => {
    test("should clear active tag and update filter", () => {
      // First select a tag
      const testTag = Tag.from("test");
      tagApp.select(testTag);

      // Then clear it
      tagApp.clear();

      expect(mockTagFilter.setActiveTag.calledWith(null)).to.be.true;
      expect(tagApp.getActiveTag()).to.be.null;
    });

    test("should fire onTagsChanged event", () => {
      let eventFired = false;
      const subscription = tagApp.onTagsChanged(() => {
        eventFired = true;
      });

      tagApp.clear();

      expect(eventFired).to.be.true;
      subscription.dispose();
    });
  });

  suite("rename", () => {
    test("should rename existing tag", () => {
      const oldTag = Tag.from("oldname");
      const newTag = Tag.from("newname");

      // Pre-populate tags list
      (tagApp as any).allTags = [oldTag];

      tagApp.rename(oldTag, "newname");

      expect((tagApp as any).allTags[0]).to.deep.equal(newTag);
    });

    test("should update active tag if renaming active tag", () => {
      const oldTag = Tag.from("oldname");

      tagApp.select(oldTag);
      tagApp.rename(oldTag, "newname");

      expect((tagApp as any).activeTag?.value).to.equal("newname");
    });

    test("should fire onTagsChanged event", () => {
      let eventFired = false;
      const subscription = tagApp.onTagsChanged(() => {
        eventFired = true;
      });

      const oldTag = Tag.from("oldname");
      (tagApp as any).allTags = [oldTag];

      tagApp.rename(oldTag, "newname");

      expect(eventFired).to.be.true;
      subscription.dispose();
    });
  });

  suite("remove", () => {
    test("should remove tag from list", () => {
      const tagToRemove = Tag.from("remove");
      const keepTag = Tag.from("keep");

      (tagApp as any).allTags = [tagToRemove, keepTag];

      tagApp.remove(tagToRemove);

      expect((tagApp as any).allTags).to.have.lengthOf(1);
      expect((tagApp as any).allTags[0]).to.deep.equal(keepTag);
    });

    test("should clear active tag if removing active tag", () => {
      const tagToRemove = Tag.from("remove");

      tagApp.select(tagToRemove);
      tagApp.remove(tagToRemove);

      expect(tagApp.getActiveTag()).to.be.null;
    });

    test("should fire onTagsChanged event", () => {
      let eventFired = false;
      const subscription = tagApp.onTagsChanged(() => {
        eventFired = true;
      });

      const tagToRemove = Tag.from("remove");
      (tagApp as any).allTags = [tagToRemove];

      tagApp.remove(tagToRemove);

      expect(eventFired).to.be.true;
      subscription.dispose();
    });
  });

  suite("getActiveTag", () => {
    test("should return null when no tag is selected", () => {
      expect(tagApp.getActiveTag()).to.be.null;
    });

    test("should return the selected tag", () => {
      const testTag = Tag.from("active");
      tagApp.select(testTag);

      expect(tagApp.getActiveTag()).to.equal(testTag);
    });
  });

  suite("Event integration", () => {
    test("should update tags when promptApp.onTreeChanged fires", async () => {
      const mockStructure: PromptStructure = {
        folders: [],
        rootPrompts: [
          {
            name: "prompt.md",
            title: "Prompt",
            path: "/test/prompt.md",
            description: "Test",
            tags: ["newtag"],
            fileSize: 100,
          },
        ],
      };

      mockIndexer.get.returns(mockStructure);

      // Trigger the event
      (mockPromptApp as any)._onTreeChanged.fire();

      // Give it a moment to process
      await new Promise((resolve) => setTimeout(resolve, 10));

      const tags = await tagApp.list();
      expect(tags).to.have.lengthOf(1);
      expect(tags[0].value).to.equal("newtag");
    });
  });

  suite("Event handling", () => {
    test("should expose onTagsChanged event", () => {
      expect(typeof tagApp.onTagsChanged).to.equal("function");
    });
  });
});
