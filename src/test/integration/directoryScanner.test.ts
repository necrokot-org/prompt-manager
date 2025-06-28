import { afterEach, beforeEach, describe, it } from "mocha";
import { expect } from "chai";
import * as sinon from "sinon";
import * as path from "path";
import * as fs from "fs";
import { DirectoryScanner } from "@root/core/DirectoryScanner";
import { FileSystemManager } from "@infra/fs/FileSystemManager";
import { ConfigurationService } from "@infra/config/config";
import { eventBus } from "@infra/vscode/ExtensionBus";
import { setupMockWorkspace, MockWorkspaceSetup } from "./helpers";
import { withFakeTimers } from "./fakeTimers";

describe("DirectoryScanner", () => {
  let scanner: DirectoryScanner;
  let fileSystemManager: FileSystemManager;
  let configurationService: ConfigurationService;
  let mockWorkspace: MockWorkspaceSetup;

  beforeEach(async () => {
    // Set up mock workspace
    mockWorkspace = await setupMockWorkspace("directory-scanner-test-");

    // Create ConfigurationService and FileSystemManager instances
    configurationService = new ConfigurationService();
    fileSystemManager = new FileSystemManager(configurationService);

    // Stub the getPromptManagerPath method to return our test directory
    sinon
      .stub(fileSystemManager, "getPromptManagerPath")
      .returns(mockWorkspace.testPromptPath);
    sinon
      .stub(fileSystemManager, "fileExists")
      .callsFake((filePath: string) => {
        try {
          return fs.existsSync(filePath);
        } catch {
          return false;
        }
      });

    // Create DirectoryScanner instance
    scanner = new DirectoryScanner(fileSystemManager);
  });

  afterEach(async () => {
    sinon.restore();
    await mockWorkspace.cleanup();
  });

  describe("scanPrompts() hierarchy verification", () => {
    it("should return correct folder and file hierarchy", async () => {
      // Create test structure
      const subfolderPath = path.join(
        mockWorkspace.testPromptPath,
        "subfolder"
      );
      const nestedFolderPath = path.join(subfolderPath, "nested");

      await fs.promises.mkdir(subfolderPath, { recursive: true });
      await fs.promises.mkdir(nestedFolderPath, { recursive: true });

      // Create test files
      await fs.promises.writeFile(
        path.join(mockWorkspace.testPromptPath, "root-prompt.md"),
        "# Root Prompt\nContent"
      );
      await fs.promises.writeFile(
        path.join(subfolderPath, "sub-prompt.md"),
        "# Sub Prompt\nContent"
      );
      await fs.promises.writeFile(
        path.join(nestedFolderPath, "nested-prompt.md"),
        "# Nested Prompt\nContent"
      );

      const result = await scanner.scanPrompts();

      expect(result).to.not.be.null;
      expect(result.rootPrompts).to.have.lengthOf(1);
      expect(result.rootPrompts[0].title).to.equal("Root Prompt");

      // Should have 2 folders: "subfolder" and "subfolder/nested" (flattened hierarchy)
      expect(result.folders).to.have.lengthOf(2);

      // Find the subfolder
      const subfolder = result.folders.find((f) => f.name === "subfolder");
      expect(subfolder).to.exist;
      expect(subfolder!.prompts).to.have.lengthOf(1);
      expect(subfolder!.prompts[0].title).to.equal("Sub Prompt");

      // Check for nested content in separate folder
      const hasNestedContent = result.folders.some((folder) =>
        folder.prompts.some((prompt) => prompt.path.includes("nested"))
      );
      expect(hasNestedContent).to.be.true;
    });

    it("should handle empty directory correctly", async () => {
      const result = await scanner.scanPrompts();

      expect(result).to.not.be.null;
      expect(result.rootPrompts).to.have.lengthOf(0);
      expect(result.folders).to.have.lengthOf(0);
    });
  });

  describe("scanDirectory() with options", () => {
    beforeEach(async () => {
      // Create test structure with files that should be excluded
      const testStructure = [
        "valid-prompt.md",
        "invalid-prompt.txt",
        ".hidden-prompt.md",
        "node_modules/some-file.md",
        "dist/build-file.md",
        "subfolder/nested-prompt.md",
        "level1/level2/level3/deep-prompt.md",
      ];

      for (const filePath of testStructure) {
        const fullPath = path.join(mockWorkspace.testPromptPath, filePath);
        await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.promises.writeFile(
          fullPath,
          `# ${path.basename(filePath, ".md")}\nContent`
        );
      }
    });

    it("should respect excludePatterns option", async () => {
      const result = await scanner.scanDirectory(mockWorkspace.testPromptPath, {
        excludePatterns: ["node_modules/**", "dist/**", ".*"],
      });

      const allFiles = [
        ...result.rootPrompts,
        ...result.folders.flatMap((f) => f.prompts),
      ];

      // Should exclude node_modules, dist, and hidden files
      expect(allFiles.some((f) => f.path.includes("node_modules"))).to.be.false;
      expect(allFiles.some((f) => f.path.includes("dist"))).to.be.false;
      expect(allFiles.some((f) => f.path.includes(".hidden-prompt"))).to.be
        .false;

      // Should include valid files (note: file names don't include extension after parsing)
      expect(allFiles.some((f) => f.name === "valid-prompt")).to.be.true;
      expect(allFiles.some((f) => f.name === "nested-prompt")).to.be.true;
    });

    it("should respect maxDepth option", async () => {
      const result = await scanner.scanDirectory(mockWorkspace.testPromptPath, {
        maxDepth: 2,
      });

      const checkMaxDepth = (folders: any[], currentDepth: number) => {
        for (const folder of folders) {
          expect(currentDepth).to.be.lessThanOrEqual(2);
        }
      };

      checkMaxDepth(result.folders, 1);

      // The deep file should not be included (level1/level2/level3 exceeds maxDepth 2)
      const allFiles = [
        ...result.rootPrompts,
        ...result.folders.flatMap((f) => f.prompts),
      ];
      expect(allFiles.some((f) => f.name === "deep-prompt.md")).to.be.false;
    });

    it("should apply both excludePatterns and maxDepth together", async () => {
      const result = await scanner.scanDirectory(mockWorkspace.testPromptPath, {
        excludePatterns: [".*"],
        maxDepth: 1,
      });

      const allFiles = [
        ...result.rootPrompts,
        ...result.folders.flatMap((f) => f.prompts),
      ];

      // Should exclude hidden files AND respect depth limit
      expect(allFiles.some((f) => f.path.includes(".hidden-prompt"))).to.be
        .false;
      // With maxDepth 1, level1 folder should not be included (as it would be depth 2 to scan its contents)
      expect(allFiles.some((f) => f.path.includes("level1/level2/level3"))).to
        .be.false;
    });
  });

  describe("IndexCache debounce functionality", () => {
    let eventBusSpy: sinon.SinonSpy;

    beforeEach(() => {
      eventBusSpy = sinon.spy(eventBus, "emit");
    });

    it("should debounce multiple invalidate calls", async () => {
      // Create a simple test file
      await fs.promises.writeFile(
        path.join(mockWorkspace.testPromptPath, "test.md"),
        "# Test\nContent"
      );

      // First scan to populate cache
      await scanner.scanPrompts();

      // Reset spy after initial scan
      eventBusSpy.resetHistory();

      // Multiple rapid invalidations - all should share the same promise
      const promises = [
        scanner.invalidateIndex(),
        scanner.invalidateIndex(),
        scanner.invalidateIndex(),
      ];

      // Wait for all invalidations to complete
      await Promise.all(promises);

      // All three calls share the same invalidation promise but each executes its own rebuild
      expect(eventBusSpy.callCount).to.equal(3);
      expect(eventBusSpy.calledWith("ui.tree.refresh.requested")).to.be.true;
    });

    it("should return same promise for rapid invalidate calls", async () => {
      const { IndexCache } = await import("../../scanner/IndexCache");
      const cache = new IndexCache(50);

      // Rapid invalidation calls should return the same promise instance
      const promise1 = cache.invalidate();
      const promise2 = cache.invalidate();
      const promise3 = cache.invalidate();

      // All promises should be the same instance
      expect(promise1).to.equal(promise2);
      expect(promise2).to.equal(promise3);

      await Promise.all([promise1, promise2, promise3]);
    });

    it("should create new promise after previous one resolves", async () => {
      const { IndexCache } = await import("../../scanner/IndexCache");
      const cache = new IndexCache(50);

      // First invalidation
      const promise1 = cache.invalidate();
      await promise1;

      // Second invalidation after first resolves should create new promise
      const promise2 = cache.invalidate();

      // Should be different promise instances
      expect(promise1).to.not.equal(promise2);

      await promise2;
    });

    it("should handle rapid invalidation with shared promise resolution", async () => {
      const { IndexCache } = await import("../../scanner/IndexCache");
      const cache = new IndexCache(100);

      let resolvedCount = 0;
      const promises: Promise<void>[] = [];

      // Create multiple rapid invalidations - all should share the same promise
      for (let i = 0; i < 5; i++) {
        const promise = cache.invalidate();
        promise.then(() => resolvedCount++);
        promises.push(promise);
      }

      // Wait for all to resolve
      await Promise.all(promises);

      // All promises should resolve (they're all the same promise)
      expect(resolvedCount).to.equal(5);
    });

    it("should handle invalidate → await → index rebuild flow", async () => {
      // Create test files
      await fs.promises.writeFile(
        path.join(mockWorkspace.testPromptPath, "initial.md"),
        "# Initial\nContent"
      );

      // Initial scan
      const initial = await scanner.scanPrompts();
      expect(initial.rootPrompts).to.have.lengthOf(1);

      // Trigger invalidation and wait for it to complete
      await scanner.invalidateIndex();

      // Add another file while cache is rebuilding
      await fs.promises.writeFile(
        path.join(mockWorkspace.testPromptPath, "added.md"),
        "# Added\nContent"
      );

      // Force rebuild to see new file
      await scanner.forceRebuildIndex();

      const updated = await scanner.scanPrompts();
      expect(updated.rootPrompts).to.have.lengthOf(2);
    });

    it("should handle concurrent buildIndex calls correctly", async () => {
      // Create test file
      await fs.promises.writeFile(
        path.join(mockWorkspace.testPromptPath, "test.md"),
        "# Test\nContent"
      );

      // Trigger multiple concurrent build attempts
      const promises = [
        scanner.buildIndex(),
        scanner.buildIndex(),
        scanner.buildIndex(),
      ];

      await Promise.all(promises);

      // Should complete without errors and have consistent state
      const result = await scanner.scanPrompts();
      expect(result.rootPrompts).to.have.lengthOf(1);
    });

    it("should clear cache structure on invalidate", async () => {
      const { IndexCache } = await import("../../scanner/IndexCache");
      const cache = new IndexCache(10);

      // Set some structure
      cache.set({
        folders: [],
        rootPrompts: [
          {
            name: "test.md",
            title: "test",
            path: "/test",
            tags: [],
            fileSize: 100,
            isDirectory: false,
          },
        ],
      });
      expect(cache.isValid()).to.be.true;

      // Invalidate doesn't clear immediately anymore - cache is cleared when timeout fires
      const promise = cache.invalidate();
      expect(cache.isValid()).to.be.true; // Still valid until timeout fires

      await promise;
      // Now cache should be cleared
      expect(cache.isValid()).to.be.false;
      expect(cache.get()).to.be.null;
    });

    it("should force invalidate immediately without debounce", async () => {
      const { IndexCache } = await import("../../scanner/IndexCache");
      const cache = new IndexCache(1000); // Long debounce to test bypass

      // Set some structure
      cache.set({
        folders: [],
        rootPrompts: [
          {
            name: "test.md",
            title: "test",
            path: "/test",
            tags: [],
            fileSize: 100,
            isDirectory: false,
          },
        ],
      });
      expect(cache.isValid()).to.be.true;

      // Force invalidate should clear immediately and return resolved promise
      const promise = cache.forceInvalidate();
      expect(cache.isValid()).to.be.false;
      expect(cache.get()).to.be.null;

      // Promise should be resolved immediately
      await promise;
    });

    it("should cancel pending debounced invalidation when force invalidating", async () => {
      const { IndexCache } = await import("../../scanner/IndexCache");
      const cache = new IndexCache(200); // Moderate debounce

      // Set some structure
      cache.set({
        folders: [],
        rootPrompts: [
          {
            name: "test.md",
            title: "test",
            path: "/test",
            tags: [],
            fileSize: 100,
            isDirectory: false,
          },
        ],
      });

      // Start a debounced invalidation
      const debouncedPromise = cache.invalidate();
      expect(cache.isValid()).to.be.true; // Cache not cleared until timeout

      // Force invalidate should clear immediately and cancel pending debounced invalidation
      const forcePromise = cache.forceInvalidate();
      expect(cache.isValid()).to.be.false; // Force clears immediately

      // Both promises should resolve
      await Promise.all([debouncedPromise, forcePromise]);

      // Cache should remain cleared
      expect(cache.isValid()).to.be.false;
      expect(cache.get()).to.be.null;
    });

    it("should resolve active promise when force invalidating", async () => {
      const { IndexCache } = await import("../../scanner/IndexCache");
      const cache = new IndexCache(1000); // Long debounce to ensure test timing

      let debouncedResolved = false;
      let forceResolved = false;

      // Start a debounced invalidation
      const debouncedPromise = cache.invalidate();
      debouncedPromise.then(() => {
        debouncedResolved = true;
      });

      // Wait a bit to ensure the timeout hasn't fired yet
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(debouncedResolved).to.be.false;

      // Force invalidate should resolve the active promise immediately
      const forcePromise = cache.forceInvalidate();
      forcePromise.then(() => {
        forceResolved = true;
      });

      // Both should resolve quickly (not wait for the original 1000ms timeout)
      await Promise.all([debouncedPromise, forcePromise]);

      expect(debouncedResolved).to.be.true;
      expect(forceResolved).to.be.true;
      expect(cache.isValid()).to.be.false;
    });

    it("should handle forceRebuildIndex correctly", async () => {
      // Create test files
      await fs.promises.writeFile(
        path.join(mockWorkspace.testPromptPath, "force-test.md"),
        "# Force Test\nContent"
      );

      // Reset spy
      eventBusSpy.resetHistory();

      // Force rebuild should work immediately
      await scanner.forceRebuildIndex();

      // Should have emitted refresh event
      expect(eventBusSpy.callCount).to.equal(1);
      expect(eventBusSpy.calledWith("ui.tree.refresh.requested")).to.be.true;

      // Should have rebuilt the index
      const result = await scanner.scanPrompts();
      expect(result.rootPrompts).to.have.lengthOf(1);
      expect(result.rootPrompts[0].title).to.equal("Force Test");
    });
  });

  describe("getAllPromptFiles()", () => {
    it("should return flat array of all prompt files", async () => {
      // Create test structure
      const subfolderPath = path.join(
        mockWorkspace.testPromptPath,
        "subfolder"
      );
      await fs.promises.mkdir(subfolderPath, { recursive: true });

      await fs.promises.writeFile(
        path.join(mockWorkspace.testPromptPath, "root1.md"),
        "# Root 1\nContent"
      );
      await fs.promises.writeFile(
        path.join(mockWorkspace.testPromptPath, "root2.md"),
        "# Root 2\nContent"
      );
      await fs.promises.writeFile(
        path.join(subfolderPath, "sub1.md"),
        "# Sub 1\nContent"
      );

      const allFiles = await scanner.getAllPromptFiles();

      expect(allFiles).to.have.lengthOf(3);
      expect(allFiles.map((f) => f.title)).to.include.members([
        "Root 1",
        "Root 2",
        "Sub 1",
      ]);
    });
  });

  describe("findPromptFiles()", () => {
    beforeEach(async () => {
      // Create test files with different properties
      await fs.promises.writeFile(
        path.join(mockWorkspace.testPromptPath, "javascript.md"),
        "---\ntags: ['javascript', 'coding']\n---\n# JS Prompt\nContent"
      );
      await fs.promises.writeFile(
        path.join(mockWorkspace.testPromptPath, "python.md"),
        "---\ntags: ['python', 'coding']\n---\n# Python Prompt\nContent"
      );
      await fs.promises.writeFile(
        path.join(mockWorkspace.testPromptPath, "design.md"),
        "---\ntags: ['design', 'ui']\n---\n# Design Prompt\nContent"
      );
    });

    it("should filter files using predicate", async () => {
      const codingFiles = await scanner.findPromptFiles((file) =>
        file.tags.includes("coding")
      );

      expect(codingFiles).to.have.lengthOf(2);
      expect(codingFiles.every((f) => f.tags.includes("coding"))).to.be.true;
    });

    it("should return empty array when no files match", async () => {
      const noMatch = await scanner.findPromptFiles((file) =>
        file.tags.includes("nonexistent")
      );

      expect(noMatch).to.have.lengthOf(0);
    });
  });

  describe("getDirectoryStats()", () => {
    beforeEach(async () => {
      // Create test files of different types
      await fs.promises.writeFile(
        path.join(mockWorkspace.testPromptPath, "prompt1.md"),
        "# Prompt 1\nShort content"
      );
      await fs.promises.writeFile(
        path.join(mockWorkspace.testPromptPath, "prompt2.md"),
        "# Prompt 2\nThis is a longer content for testing file size calculations"
      );

      const subfolderPath = path.join(
        mockWorkspace.testPromptPath,
        "subfolder"
      );
      await fs.promises.mkdir(subfolderPath, { recursive: true });
      await fs.promises.writeFile(
        path.join(subfolderPath, "nested.md"),
        "# Nested\nNested content"
      );
    });

    it("should return correct directory statistics", async () => {
      const stats = await scanner.getDirectoryStats();

      expect(stats.totalFiles).to.equal(3);
      expect(stats.totalFolders).to.equal(1);
      expect(stats.totalSize).to.be.greaterThan(0);
      expect(stats.fileTypes[".md"]).to.equal(3);
    });

    it("should return zero stats for non-existent directory", async () => {
      const stats = await scanner.getDirectoryStats("/nonexistent/path");

      expect(stats.totalFiles).to.equal(0);
      expect(stats.totalFolders).to.equal(0);
      expect(stats.totalSize).to.equal(0);
      expect(Object.keys(stats.fileTypes)).to.have.lengthOf(0);
    });
  });

  describe("error handling", () => {
    it("should handle filesystem errors gracefully", async () => {
      // Stub fileExists to return true but walker to throw
      sinon.restore();
      sinon
        .stub(fileSystemManager, "getPromptManagerPath")
        .returns("/invalid/path");
      sinon.stub(fileSystemManager, "fileExists").returns(true);

      // Create new scanner with stubbed fileSystemManager
      const errorScanner = new DirectoryScanner(fileSystemManager);

      const result = await errorScanner.scanPrompts();

      // Should return empty structure on error
      expect(result.rootPrompts).to.have.lengthOf(0);
      expect(result.folders).to.have.lengthOf(0);
    });
  });
});
