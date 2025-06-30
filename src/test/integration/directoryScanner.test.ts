import { setup, teardown, suite, test } from "mocha";
import { expect } from "chai";
import * as sinon from "sinon";
import * as path from "path";
import * as fs from "fs";
import { DirectoryScanner } from "@root/core/DirectoryScanner";
import { FileSystemManager } from "@infra/fs/FileSystemManager";
import { ConfigurationService } from "@infra/config/config";
import { eventBus } from "@infra/vscode/ExtensionBus";
import { setupMockWorkspace, MockWorkspaceSetup } from "./helpers";

suite("DirectoryScanner", () => {
  let scanner: DirectoryScanner;
  let fileSystemManager: FileSystemManager;
  let configurationService: ConfigurationService;
  let mockWorkspace: MockWorkspaceSetup;

  setup(async () => {
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

  teardown(async () => {
    sinon.restore();
    await mockWorkspace.cleanup();
  });

  test("scanPrompts() hierarchy verification", async () => {
    // Create test structure
    const subfolderPath = path.join(mockWorkspace.testPromptPath, "subfolder");
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

  test("scanPrompts() should handle empty directory correctly", async () => {
    const result = await scanner.scanPrompts();

    expect(result).to.not.be.null;
    expect(result.rootPrompts).to.have.lengthOf(0);
    expect(result.folders).to.have.lengthOf(0);
  });

  test("scanDirectory() with options", async () => {
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
    expect(allFiles.some((f) => f.path.includes(".hidden-prompt"))).to.be.false;

    // Should include valid files (note: file names don't include extension after parsing)
    expect(allFiles.some((f) => f.name === "valid-prompt")).to.be.true;
    expect(allFiles.some((f) => f.name === "nested-prompt")).to.be.true;
  });

  test("scanDirectory() should respect maxDepth option", async () => {
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

  test("scanDirectory() should apply both excludePatterns and maxDepth together", async () => {
    const result = await scanner.scanDirectory(mockWorkspace.testPromptPath, {
      excludePatterns: [".*"],
      maxDepth: 1,
    });

    const allFiles = [
      ...result.rootPrompts,
      ...result.folders.flatMap((f) => f.prompts),
    ];

    // Should exclude hidden files AND respect depth limit
    expect(allFiles.some((f) => f.path.includes(".hidden-prompt"))).to.be.false;
    // With maxDepth 1, level1 folder should not be included (as it would be depth 2 to scan its contents)
    expect(allFiles.some((f) => f.path.includes("level1/level2/level3"))).to.be
      .false;
  });

  test("IndexManager functionality", async () => {
    let eventBusSpy = sinon.spy(eventBus, "emit");

    // Create a simple test file
    await fs.promises.writeFile(
      path.join(mockWorkspace.testPromptPath, "test.md"),
      "# Test\nContent"
    );

    // First scan to populate cache
    await scanner.scanPrompts();

    // Reset spy after initial scan
    eventBusSpy.resetHistory();

    // Multiple rapid rebuildIndex calls - all should share the same promise
    const promises = [
      scanner.rebuildIndex(),
      scanner.rebuildIndex(),
      scanner.rebuildIndex(),
    ];

    // Wait for all rebuildIndex calls to complete
    await Promise.all(promises);

    // All three calls share the same rebuildIndex promise, so only one UI refresh event should be emitted
    // This is the expected behavior to prevent race conditions and duplicate UI updates
    expect(eventBusSpy.callCount).to.equal(1);
    expect(eventBusSpy.calledWith("ui.tree.refresh.requested")).to.be.true;
  });

  test("IndexManager functionality should handle rebuildIndex → await → index rebuild flow", async () => {
    // Create test files
    await fs.promises.writeFile(
      path.join(mockWorkspace.testPromptPath, "initial.md"),
      "# Initial\nContent"
    );

    // Initial scan
    const initial = await scanner.scanPrompts();
    expect(initial.rootPrompts).to.have.lengthOf(1);

    // Trigger rebuildIndex and wait for it to complete
    await scanner.rebuildIndex();

    // Add another file while cache is rebuilding
    await fs.promises.writeFile(
      path.join(mockWorkspace.testPromptPath, "added.md"),
      "# Added\nContent"
    );

    // Force rebuild to see new file
    await scanner.rebuildIndexForce();

    const updated = await scanner.scanPrompts();
    expect(updated.rootPrompts).to.have.lengthOf(2);
  });

  suite("scanPrompts() hierarchy verification", () => {
    test("should return correct folder and file hierarchy", async () => {
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

    test("should handle empty directory correctly", async () => {
      const result = await scanner.scanPrompts();

      expect(result).to.not.be.null;
      expect(result.rootPrompts).to.have.lengthOf(0);
      expect(result.folders).to.have.lengthOf(0);
    });
  });

  suite("scanDirectory() with options", () => {
    setup(async () => {
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

    test("should respect excludePatterns option", async () => {
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

    test("should respect maxDepth option", async () => {
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

    test("should apply both excludePatterns and maxDepth together", async () => {
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

  suite("IndexManager functionality", () => {
    let eventBusSpy: sinon.SinonSpy;

    setup(() => {
      eventBusSpy = sinon.spy(eventBus, "emit");
    });

    test("should debounce multiple rebuildIndex calls", async () => {
      // Create a simple test file
      await fs.promises.writeFile(
        path.join(mockWorkspace.testPromptPath, "test.md"),
        "# Test\nContent"
      );

      // First scan to populate cache
      await scanner.scanPrompts();

      // Reset spy after initial scan
      eventBusSpy.resetHistory();

      // Multiple rapid rebuildIndex calls - all should share the same promise
      const promises = [
        scanner.rebuildIndex(),
        scanner.rebuildIndex(),
        scanner.rebuildIndex(),
      ];

      // Wait for all rebuildIndex calls to complete
      await Promise.all(promises);

      // All three calls share the same rebuildIndex promise, so only one UI refresh event should be emitted
      // This is the expected behavior to prevent race conditions and duplicate UI updates
      expect(eventBusSpy.callCount).to.equal(1);
      expect(eventBusSpy.calledWith("ui.tree.refresh.requested")).to.be.true;
    });

    test("should handle rebuildIndex → await → index rebuild flow", async () => {
      // Create test files
      await fs.promises.writeFile(
        path.join(mockWorkspace.testPromptPath, "initial.md"),
        "# Initial\nContent"
      );

      // Initial scan
      const initial = await scanner.scanPrompts();
      expect(initial.rootPrompts).to.have.lengthOf(1);

      // Trigger rebuildIndex and wait for it to complete
      await scanner.rebuildIndex();

      // Add another file while cache is rebuilding
      await fs.promises.writeFile(
        path.join(mockWorkspace.testPromptPath, "added.md"),
        "# Added\nContent"
      );

      // Force rebuild to see new file
      await scanner.rebuildIndexForce();

      const updated = await scanner.scanPrompts();
      expect(updated.rootPrompts).to.have.lengthOf(2);
    });

    test("should handle concurrent buildIndex calls correctly", async () => {
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

    test("should handle rebuildIndexForce correctly", async () => {
      // Create test files
      await fs.promises.writeFile(
        path.join(mockWorkspace.testPromptPath, "force-test.md"),
        "# Force Test\nContent"
      );

      // Reset spy
      eventBusSpy.resetHistory();

      // Force rebuild should work immediately
      await scanner.rebuildIndexForce();

      // Should have emitted refresh event
      expect(eventBusSpy.callCount).to.equal(1);
      expect(eventBusSpy.calledWith("ui.tree.refresh.requested")).to.be.true;

      // Should have rebuilt the index
      const result = await scanner.scanPrompts();
      expect(result.rootPrompts).to.have.lengthOf(1);
      expect(result.rootPrompts[0].title).to.equal("Force Test");
    });

    test("should cache structure and rebuild when needed", async () => {
      // Create test file
      await fs.promises.writeFile(
        path.join(mockWorkspace.testPromptPath, "cached.md"),
        "# Cached\nContent"
      );

      // First scan should build index
      const first = await scanner.scanPrompts();
      expect(first.rootPrompts).to.have.lengthOf(1);

      // Second scan should use cached structure (no rebuild needed)
      const second = await scanner.scanPrompts();
      expect(second.rootPrompts).to.have.lengthOf(1);
      expect(second).to.deep.equal(first);

      // Force rebuild should refresh the cache
      await scanner.rebuildIndexForce();
      const third = await scanner.scanPrompts();
      expect(third.rootPrompts).to.have.lengthOf(1);
    });

    test("should handle empty directory gracefully", async () => {
      // Scan empty directory
      const result = await scanner.scanPrompts();
      expect(result.folders).to.have.lengthOf(0);
      expect(result.rootPrompts).to.have.lengthOf(0);
    });
  });

  suite("error handling", () => {
    test("should handle filesystem errors gracefully", async () => {
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
