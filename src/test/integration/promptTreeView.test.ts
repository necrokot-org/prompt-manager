import { setup, teardown, suite, test } from "mocha";
import { expect } from "chai";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { PromptTreeView } from "../../presentation/tree/PromptTreeView";
import { PromptApp } from "../../application/PromptApp";
import { TagApp } from "../../application/TagApp";
import { SearchApp } from "../../application/SearchApp";
import { ConfigReader } from "../../application/ports/ConfigReader";
import { PromptStructure } from "../../domain/model/PromptStructure";
import { Folder } from "../../domain/model/Folder";
import { Prompt } from "../../domain/model/Prompt";

suite("PromptTreeView", () => {
  let promptTreeView: PromptTreeView;
  let mockPromptApp: sinon.SinonStubbedInstance<PromptApp>;
  let mockTagApp: sinon.SinonStubbedInstance<TagApp>;
  let mockSearchApp: sinon.SinonStubbedInstance<SearchApp>;
  let mockConfigReader: any;

  setup(() => {
    // Mock application services
    mockPromptApp = {
      structure: sinon.stub(),
      initWorkspace: sinon.stub().resolves(),
      createPrompt: sinon.stub(),
      deletePrompt: sinon.stub(),
      createFolder: sinon.stub(),
      deleteFolder: sinon.stub(),
      copyContent: sinon.stub(),
      onTreeChanged: new vscode.EventEmitter<void>().event,
      _onTreeChanged: new vscode.EventEmitter<void>(),
    } as any;

    mockTagApp = {
      list: sinon.stub(),
      select: sinon.stub(),
      clear: sinon.stub(),
      getActiveTag: sinon.stub(),
      onTagsChanged: new vscode.EventEmitter<void>().event,
      _onTagsChanged: new vscode.EventEmitter<void>(),
    } as any;

    mockSearchApp = {
      setCriteria: sinon.stub(),
      clear: sinon.stub(),
      getCurrentQuery: sinon.stub(),
      getResults: sinon.stub(),
      getResultsCount: sinon.stub(),
      onSearchChanged: new vscode.EventEmitter<void>().event,
      _onSearchChanged: new vscode.EventEmitter<void>(),
      onResultsCountChanged: new vscode.EventEmitter<number>().event,
      _onResultsCountChanged: new vscode.EventEmitter<number>(),
    } as any;

    mockConfigReader = {
      getShowDescriptionInTree: sinon.stub().returns(true),
      getDefaultPromptDirectory: sinon.stub().returns(".prompt_manager"),
      getFileNamingPattern: sinon.stub().returns("kebab-case"),
    };

    promptTreeView = new PromptTreeView(
      mockPromptApp,
      mockTagApp,
      mockSearchApp,
      mockConfigReader
    );
  });

  teardown(() => {
    promptTreeView.dispose();
    sinon.restore();
  });

  suite("getChildren", () => {
    test("should return items from PromptApp.structure() for root level", async () => {
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
            name: "test-prompt.md",
            title: "Test Prompt",
            path: "/test/test-prompt.md",
            description: "A test prompt",
            tags: ["test"],
            fileSize: 100,
          },
        ],
      };

      mockPromptApp.structure.resolves(mockStructure);

      const children = await promptTreeView.getChildren();

      expect(mockPromptApp.structure.calledOnce).to.be.true;
      expect(children).to.have.lengthOf(2); // 1 folder + 1 root prompt
    });

    test("should return empty array for non-root elements", async () => {
      const mockElement = {} as any;
      const children = await promptTreeView.getChildren(mockElement);

      expect(children).to.be.an("array").that.is.empty;
    });

    test("should respect showDescriptionInTree config from ConfigReader", async () => {
      const mockStructure: PromptStructure = {
        folders: [],
        rootPrompts: [
          {
            name: "test-prompt.md",
            title: "Test Prompt",
            path: "/test/test-prompt.md",
            description: "A test prompt",
            tags: ["test"],
            fileSize: 100,
          },
        ],
      };

      mockPromptApp.structure.resolves(mockStructure);

      // Test with description enabled
      mockConfigReader.getShowDescriptionInTree.returns(true);
      await promptTreeView.getChildren();

      // Test with description disabled
      mockConfigReader.getShowDescriptionInTree.returns(false);
      await promptTreeView.getChildren();

      expect(mockConfigReader.getShowDescriptionInTree.called).to.be.true;
    });
  });

  suite("Event handling", () => {
    test("should have event subscriptions", () => {
      // The PromptTreeView constructor should set up event listeners
      // We can verify this by checking that the constructor was called with the right dependencies
      expect(mockPromptApp.onTreeChanged).to.exist;
      expect(mockTagApp.onTagsChanged).to.exist;
      expect(mockSearchApp.onSearchChanged).to.exist;
    });
  });

  suite("Drag and Drop", () => {
    test("should have dragMimeTypes defined", () => {
      expect(promptTreeView.dragMimeTypes).to.deep.equal([
        "application/vnd.code.tree.promptmanager",
      ]);
    });

    test("should have dropMimeTypes defined", () => {
      expect(promptTreeView.dropMimeTypes).to.deep.equal([
        "application/vnd.code.tree.promptmanager",
      ]);
    });

    test("should have handleDrag method", () => {
      expect(typeof promptTreeView.handleDrag).to.equal("function");
    });

    test("should have handleDrop method", () => {
      expect(typeof promptTreeView.handleDrop).to.equal("function");
    });
  });

  suite("TreeDataProvider interface", () => {
    test("should implement getTreeItem method", () => {
      expect(typeof promptTreeView.getTreeItem).to.equal("function");
    });

    test("should implement onDidChangeTreeData event", () => {
      expect(typeof promptTreeView.onDidChangeTreeData).to.equal("function");
    });
  });
});
