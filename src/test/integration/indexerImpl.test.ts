import { setup, teardown, suite, test } from "mocha";
import { expect } from "chai";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { IndexerImpl } from "../../infrastructure/prompt/indexing/IndexerImpl";
import { FileSystemManager } from "../../infrastructure/fs/FileSystemManager";
import { FilesystemWalker } from "../../scanner/FilesystemWalker";
import { PromptOrganizer } from "../../scanner/PromptOrganizer";
import { PromptStructure } from "../../domain/model/PromptStructure";

suite("IndexerImpl", () => {
  let indexer: IndexerImpl;
  let mockFileSystem: sinon.SinonStubbedInstance<FileSystemManager>;
  let mockWalker: sinon.SinonStubbedInstance<FilesystemWalker>;
  let mockOrganizer: sinon.SinonStubbedInstance<PromptOrganizer>;

  setup(() => {
    // Mock dependencies
    mockFileSystem = sinon.createStubInstance(FileSystemManager);
    mockWalker = sinon.createStubInstance(FilesystemWalker);
    mockOrganizer = sinon.createStubInstance(PromptOrganizer);

    // Setup mock behaviors
    mockFileSystem.getPromptManagerPath.returns("/test/prompts");
    mockFileSystem.fileExists.returns(true);

    // Create IndexerImpl with mocked dependencies
    indexer = new IndexerImpl(mockFileSystem);

    // Replace the internal components with mocks (this is a bit hacky but necessary for testing)
    (indexer as any).walker = mockWalker;
    (indexer as any).organizer = mockOrganizer;
  });

  teardown(() => {
    sinon.restore();
  });

  test("should return null when no cache exists", () => {
    const result = indexer.get();
    expect(result).to.be.null;
  });

  test("should build index successfully", async () => {
    const mockPromptFiles = [
      {
        name: "test1",
        title: "Test Prompt 1",
        path: "/test/prompts/test1.md",
        description: "A test prompt",
        tags: ["test", "example"],
        fileSize: 1024,
        isDirectory: false,
      },
    ];

    const mockStructure: PromptStructure = {
      folders: [],
      rootPrompts: mockPromptFiles,
    };

    mockWalker.scanDirectory.resolves(mockPromptFiles);
    mockOrganizer.organize.resolves(mockStructure);

    const result = await indexer.build();

    expect(result).to.equal(mockStructure);
    expect(indexer.get()).to.equal(mockStructure);
    expect(mockWalker.scanDirectory.calledWith("/test/prompts")).to.be.true;
    expect(mockOrganizer.organize.calledWith(mockPromptFiles, "/test/prompts"))
      .to.be.true;
  });

  test("should return empty structure when root path doesn't exist", async () => {
    mockFileSystem.fileExists.returns(false);

    const result = await indexer.build();

    expect(result.folders).to.be.an("array").that.is.empty;
    expect(result.rootPrompts).to.be.an("array").that.is.empty;
  });

  test("should return empty structure when root path is undefined", async () => {
    mockFileSystem.getPromptManagerPath.returns(undefined);

    const result = await indexer.build();

    expect(result.folders).to.be.an("array").that.is.empty;
    expect(result.rootPrompts).to.be.an("array").that.is.empty;
  });

  test("should handle scan errors gracefully", async () => {
    mockWalker.scanDirectory.rejects(new Error("Scan failed"));

    const result = await indexer.build();

    expect(result.folders).to.be.an("array").that.is.empty;
    expect(result.rootPrompts).to.be.an("array").that.is.empty;
  });

  test("should handle organize errors gracefully", async () => {
    mockWalker.scanDirectory.resolves([]);
    mockOrganizer.organize.rejects(new Error("Organize failed"));

    const result = await indexer.build();

    expect(result.folders).to.be.an("array").that.is.empty;
    expect(result.rootPrompts).to.be.an("array").that.is.empty;
  });

  test("should debounce rebuild calls", async () => {
    const mockStructure: PromptStructure = {
      folders: [],
      rootPrompts: [
        {
          name: "test",
          title: "Test",
          path: "/test/prompts/test.md",
          description: "",
          tags: [],
          fileSize: 100,
        },
      ],
    };

    mockWalker.scanDirectory.resolves([]);
    mockOrganizer.organize.resolves(mockStructure);

    // Start multiple rebuild calls
    const promise1 = indexer.rebuild();
    const promise2 = indexer.rebuild();
    const promise3 = indexer.rebuild();

    // All should return the same result
    const [result1, result2, result3] = await Promise.all([
      promise1,
      promise2,
      promise3,
    ]);

    expect(result1).to.equal(result2).and.equal(result3);
    expect(mockWalker.scanDirectory.calledOnce).to.be.true;
    expect(mockOrganizer.organize.calledOnce).to.be.true;
  });

  test("should rebuild immediately when rebuildNow is called", async () => {
    const mockStructure: PromptStructure = {
      folders: [],
      rootPrompts: [
        {
          name: "test",
          title: "Test",
          path: "/test/prompts/test.md",
          description: "",
          tags: [],
          fileSize: 100,
        },
      ],
    };

    mockWalker.scanDirectory.resolves([]);
    mockOrganizer.organize.resolves(mockStructure);

    const result = await indexer.rebuildNow();

    expect(result).to.equal(mockStructure);
    expect(mockWalker.scanDirectory.calledOnce).to.be.true;
    expect(mockOrganizer.organize.calledOnce).to.be.true;
  });

  test("should cancel pending debounce on rebuildNow", async () => {
    const mockStructure: PromptStructure = {
      folders: [],
      rootPrompts: [],
    };

    mockWalker.scanDirectory.resolves([]);
    mockOrganizer.organize.resolves(mockStructure);

    // Start a debounced rebuild
    const debouncedPromise = indexer.rebuild();

    // Immediately call rebuildNow
    const immediateResult = await indexer.rebuildNow();

    // Wait for debounced call to complete
    await debouncedPromise;

    expect(immediateResult).to.equal(mockStructure);
    expect(mockWalker.scanDirectory.calledTwice).to.be.true; // Called once for each rebuild
    expect(mockOrganizer.organize.calledTwice).to.be.true;
  });

  test("should reuse in-flight build operations", async () => {
    const mockStructure: PromptStructure = {
      folders: [],
      rootPrompts: [],
    };

    mockWalker.scanDirectory.resolves([]);
    mockOrganizer.organize.resolves(mockStructure);

    // Start multiple build calls simultaneously
    const promise1 = indexer.build();
    const promise2 = indexer.build();
    const promise3 = indexer.build();

    const [result1, result2, result3] = await Promise.all([
      promise1,
      promise2,
      promise3,
    ]);

    // All should return the same result
    expect(result1).to.equal(result2).and.equal(result3);
    expect(result1).to.equal(mockStructure);

    // Should only call scan and organize once due to in-flight deduplication
    expect(mockWalker.scanDirectory.calledOnce).to.be.true;
    expect(mockOrganizer.organize.calledOnce).to.be.true;
  });

  test("should handle build errors in debounced rebuild", async () => {
    mockWalker.scanDirectory.rejects(new Error("Build failed"));

    try {
      await indexer.rebuild();
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect((error as Error).message).to.equal("Build failed");
    }
  });

  test("should clear debounce timer on rebuildNow", async () => {
    const mockStructure: PromptStructure = {
      folders: [],
      rootPrompts: [],
    };

    mockWalker.scanDirectory.resolves([]);
    mockOrganizer.organize.resolves(mockStructure);

    // Start debounced rebuild
    indexer.rebuild();

    // Call rebuildNow which should clear the timer
    await indexer.rebuildNow();

    // Verify timer was cleared (we can't directly test this, but we can verify the behavior)
    expect(mockWalker.scanDirectory.calledTwice).to.be.true;
  });
});
