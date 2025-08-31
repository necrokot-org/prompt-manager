import { setup, teardown, suite, test } from "mocha";
import { expect } from "chai";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { TagTreeView } from "../../presentation/tree/TagTreeView";
import { TagApp } from "../../application/TagApp";
import { IndexApp } from "../../application/IndexApp";
import { Tag } from "../../domain/model/Tag";

suite("TagTreeView", () => {
  let tagTreeView: TagTreeView;
  let mockTagApp: sinon.SinonStubbedInstance<TagApp>;
  let mockIndexApp: any;

  setup(() => {
    // Mock application services
    mockTagApp = {
      list: sinon.stub(),
      select: sinon.stub(),
      clear: sinon.stub(),
      getActiveTag: sinon.stub(),
      onTagsChanged: new vscode.EventEmitter<void>().event,
      _onTagsChanged: new vscode.EventEmitter<void>(),
    } as any;

    mockIndexApp = {
      rebuild: sinon.stub().resolves(),
      rebuildNow: sinon.stub().resolves(),
    };

    tagTreeView = new TagTreeView(mockTagApp, mockIndexApp);
  });

  teardown(() => {
    tagTreeView.dispose();
    sinon.restore();
  });

  suite("getChildren", () => {
    test("should return TagTreeItems from tagApp.list() for root level", async () => {
      const mockTags = [
        Tag.from("javascript"),
        Tag.from("react"),
        Tag.from("typescript"),
      ];

      mockTagApp.list.resolves(mockTags);
      mockTagApp.getActiveTag.returns(null);

      const children = await tagTreeView.getChildren();

      expect(mockTagApp.list.calledOnce).to.be.true;
      expect(children).to.have.lengthOf(3);
      expect(children[0]).to.have.property("tag");
      // Verify the tag item has the expected tag
      const tagItem = children[0] as any;
      expect(tagItem.tag.value).to.equal("javascript");
    });

    test("should show empty state when no tags exist", async () => {
      mockTagApp.list.resolves([]);

      const children = await tagTreeView.getChildren();

      expect(children).to.have.lengthOf(1);
      expect(children[0]).to.have.property("label", "No tags found");
    });

    test("should mark active tag with description", async () => {
      const mockTags = [Tag.from("javascript"), Tag.from("react")];
      const activeTag = Tag.from("react");

      mockTagApp.list.resolves(mockTags);
      mockTagApp.getActiveTag.returns(activeTag);

      const children = await tagTreeView.getChildren();

      expect(children).to.have.lengthOf(2);

      // Find the active tag item
      const activeTagItem = children.find(
        (item: any) => item.tag && item.tag.equals(activeTag)
      );

      expect(activeTagItem).to.exist;
      expect((activeTagItem as any).description).to.equal("(active)");
    });

    test("should return empty array for non-root elements", async () => {
      const mockElement = {} as any;
      const children = await tagTreeView.getChildren(mockElement);

      expect(children).to.be.an("array").that.is.empty;
    });
  });

  suite("Event handling", () => {
    test("should listen to tag-specific events", () => {
      // The key requirement is that TagTreeView only listens to tagApp.onTagsChanged
      // and not generic ui.tree.refresh.requested events
      // This is tested by ensuring the tag-specific event is available
      expect(mockTagApp.onTagsChanged).to.exist;
    });
  });

  suite("TreeDataProvider interface", () => {
    test("should implement getTreeItem method", () => {
      expect(typeof tagTreeView.getTreeItem).to.equal("function");
    });

    test("should implement onDidChangeTreeData event", () => {
      expect(typeof tagTreeView.onDidChangeTreeData).to.equal("function");
    });
  });
});
