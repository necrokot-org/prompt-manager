import * as assert from "assert";
import * as vscode from "vscode";
import * as sinon from "sinon";
import { FileSystemManager } from "@infra/fs/FileSystemManager";
import { ConfigurationService } from "@infra/config/config";
import { FileManager } from "@features/prompt-manager/data/fileManager";
import { PromptRepository } from "@features/prompt-manager/domain/promptRepository";
import { SearchService } from "@features/search/services/searchService";
import { eventBus, ExtensionSubscription } from "@infra/vscode/ExtensionBus";
import { setupMockWorkspace, MockWorkspaceSetup } from "./helpers";

suite("Integration Flow Tests", () => {
  let mockWorkspace: MockWorkspaceSetup;
  let fileManager: FileManager;
  let promptRepository: PromptRepository;
  let searchService: SearchService;
  let configService: ConfigurationService;
  let fileSystemManager: FileSystemManager;
  let clipboardStub: sinon.SinonStub;
  let showErrorStub: sinon.SinonStub;

  suiteSetup(async () => {
    // Set up mock workspace with temporary directory
    mockWorkspace = await setupMockWorkspace("integration-flow-test-");

    // Create dependencies manually for testing
    configService = new ConfigurationService();
    fileSystemManager = new FileSystemManager(configService);
    fileManager = new FileManager(fileSystemManager);
    searchService = new SearchService(fileManager);
    promptRepository = new PromptRepository(fileManager, searchService);

    // Ensure prompt manager directory exists and build initial index
    await fileManager.ensurePromptManagerDirectory();
    await fileManager.rebuildIndexForce();
  });

  setup(async () => {
    // Set up stubs for each test (skip clipboard stub as it's non-configurable)
    showErrorStub = sinon.stub(vscode.window, "showErrorMessage").resolves();

    // Mock clipboard functionality instead of stubbing the non-configurable property
    const originalWriteText = vscode.env.clipboard.writeText;
    clipboardStub = sinon.stub().resolves();
    // We'll verify the stub was called instead of the actual clipboard

    // Clear search cache before each test
    searchService.clearCache();

    // Force rebuild index to ensure clean state
    await fileManager.rebuildIndexForce();

    // Small delay to ensure operations complete
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  teardown(async () => {
    // Clean up any remaining test files
    const structure = await fileManager.scanPrompts();
    const testFiles = [
      ...structure.rootPrompts,
      ...structure.folders.flatMap((f) => f.prompts),
    ].filter((f) => f.name.includes("test") || f.name.includes("integration"));

    for (const file of testFiles) {
      try {
        await fileManager.deletePromptFile(file.path);
      } catch (error) {
        // Ignore errors during cleanup
      }
    }

    // Force rebuild after cleanup
    await fileManager.rebuildIndexForce();

    // Restore all stubs after each test
    sinon.restore();

    // Small delay to ensure cleanup completes
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  suiteTeardown(async () => {
    // Clean up temporary directory
    await mockWorkspace.cleanup();
  });

  test("should handle prompt file creation and emit events", async () => {
    // Setup event listener
    let fileCreatedEvent: any = null;
    const subscription = eventBus.on("filesystem.file.created", (payload) => {
      fileCreatedEvent = payload;
    });

    try {
      // Get initial index stats
      const initialStructure = await fileManager.scanPrompts();
      const initialFileCount = initialStructure.rootPrompts.length;

      // Create a prompt file through fileManager
      const promptName = "integration-test-prompt";
      const filePath = await fileManager.createPromptFile(promptName);

      // Verify prompt was created
      assert.ok(filePath, "Should return file path");
      assert.ok(
        filePath!.includes(promptName),
        "File path should contain prompt name"
      );

      // Force rebuild index to ensure changes are reflected
      await fileManager.rebuildIndexForce();

      // Wait a moment for event to be processed
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify filesystem.file.created event was emitted
      assert.ok(
        fileCreatedEvent,
        "filesystem.file.created event should be emitted"
      );
      assert.strictEqual(fileCreatedEvent.fileName, `${promptName}.md`);
      assert.ok(fileCreatedEvent.filePath.includes(promptName));

      // Verify tree refresh would be triggered (via DirectoryScanner index update)
      const updatedStructure = await fileManager.scanPrompts();
      const updatedFileCount = updatedStructure.rootPrompts.length;
      assert.strictEqual(
        updatedFileCount,
        initialFileCount + 1,
        "File count should increase by 1"
      );

      // Verify the created prompt exists in the structure
      const createdPrompt = updatedStructure.rootPrompts.find(
        (p) => p.name === promptName
      );
      assert.ok(
        createdPrompt,
        `Created prompt should exist in directory structure. Available: ${updatedStructure.rootPrompts
          .map((p) => p.name)
          .join(", ")}`
      );
      assert.strictEqual(createdPrompt.title, promptName);

      // Clean up the created file
      await fileManager.deletePromptFile(filePath!);
      await fileManager.rebuildIndexForce();
    } finally {
      subscription.dispose();
    }
  });

  test("should handle prompt content reading for clipboard operations", async () => {
    // First create a test prompt
    const promptName = "copy-test-prompt";
    const filePath = await fileManager.createPromptFile(promptName);
    assert.ok(filePath);

    // Write some content to the prompt
    const testContent = "# Test Prompt\n\nThis is test content for copying.";
    await fileSystemManager.writeFile(filePath!, testContent);

    // Force rebuild index to ensure file is indexed
    await fileManager.rebuildIndexForce();

    // Read content through repository (simulating clipboard operation)
    const content = await promptRepository.readFileContent(filePath!);
    assert.ok(content, "Should read file content");
    assert.strictEqual(
      content,
      testContent,
      "Content should match written content"
    );

    // Clean up
    await fileManager.deletePromptFile(filePath!);
    await fileManager.rebuildIndexForce();

    // Note: clipboard operation would normally be tested here, but
    // vscode.env.clipboard.writeText is non-configurable in test environment
    // The actual functionality can be verified through integration tests
  });

  test("should handle prompt deletion and emit events", async () => {
    // Setup event listener for deletion
    let resourceDeletedEvent: any = null;
    const subscription = eventBus.on(
      "filesystem.resource.deleted",
      (payload) => {
        resourceDeletedEvent = payload;
      }
    );

    try {
      // First create a test prompt
      const promptName = "delete-test-prompt";
      const filePath = await fileManager.createPromptFile(promptName);
      assert.ok(filePath);

      // Force rebuild to ensure file is indexed
      await fileManager.rebuildIndexForce();

      // Get initial index stats
      const initialStructure = await fileManager.scanPrompts();
      const initialFileCount = initialStructure.rootPrompts.length;

      // Delete prompt through fileManager
      const deleteResult = await fileManager.deletePromptFile(filePath!);
      assert.ok(deleteResult, "Prompt deletion should succeed");

      // Force rebuild index to ensure changes are reflected
      await fileManager.rebuildIndexForce();

      // Wait a moment for event to be processed
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify filesystem.resource.deleted event was emitted for the file
      assert.ok(
        resourceDeletedEvent,
        "filesystem.resource.deleted event should be emitted"
      );
      assert.strictEqual(resourceDeletedEvent.name, `${promptName}.md`);
      assert.ok(resourceDeletedEvent.path.includes(promptName));

      // Ensure cache invalidated and tree refresh triggered
      const updatedStructure = await fileManager.scanPrompts();
      const updatedFileCount = updatedStructure.rootPrompts.length;
      assert.strictEqual(
        updatedFileCount,
        initialFileCount - 1,
        "File count should decrease by 1"
      );

      // Verify the deleted prompt no longer exists in the structure
      const deletedPrompt = updatedStructure.rootPrompts.find(
        (p) => p.name === `${promptName}.md`
      );
      assert.strictEqual(
        deletedPrompt,
        undefined,
        "Deleted prompt should not exist in directory structure"
      );
    } finally {
      subscription.dispose();
    }
  });

  test("should verify EventBus payload correctness", async () => {
    // Track all events during prompt lifecycle
    const events: Array<{ type: string; payload: any }> = [];

    const createdSubscription = eventBus.on(
      "filesystem.file.created",
      (payload) => events.push({ type: "created", payload })
    );
    const deletedSubscription = eventBus.on(
      "filesystem.resource.deleted",
      (payload) => {
        events.push({ type: "deleted", payload });
      }
    );

    try {
      const promptName = "eventbus-test-prompt";

      // Create prompt
      const filePath = await fileManager.createPromptFile(promptName);
      assert.ok(filePath);

      // Force rebuild and wait for create event
      await fileManager.rebuildIndexForce();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Delete prompt
      const deleteResult = await fileManager.deletePromptFile(filePath!);
      assert.ok(deleteResult);

      // Force rebuild and wait for delete event
      await fileManager.rebuildIndexForce();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify event payload correctness
      assert.strictEqual(
        events.length,
        2,
        "Should have exactly 2 events (created + deleted)"
      );

      // Verify created event payload
      const createdEvent = events.find((e) => e.type === "created");
      assert.ok(createdEvent, "Should have created event");
      assert.strictEqual(createdEvent.payload.fileName, `${promptName}.md`);
      assert.ok(createdEvent.payload.filePath);
      assert.ok(createdEvent.payload.filePath.endsWith(`${promptName}.md`));

      // Verify deleted event payload
      const deletedEvent = events.find((e) => e.type === "deleted");
      assert.ok(deletedEvent, "Should have deleted event");
      assert.strictEqual(deletedEvent.payload.name, `${promptName}.md`);
      assert.ok(deletedEvent.payload.path);
      assert.ok(deletedEvent.payload.path.endsWith(`${promptName}.md`));
    } finally {
      createdSubscription.dispose();
      deletedSubscription.dispose();
    }
  });

  test("should verify FileManager index stats during operations", async () => {
    // Get baseline stats
    const baseline = await fileManager.scanPrompts();
    const baselineCount = baseline.rootPrompts.length;

    // Create multiple prompts
    const promptNames = ["stats-test-1", "stats-test-2", "stats-test-3"];
    const createdPaths: string[] = [];

    for (const name of promptNames) {
      const filePath = await fileManager.createPromptFile(name);
      assert.ok(filePath);
      createdPaths.push(filePath!);
    }

    // Force rebuild to ensure all files are indexed
    await fileManager.rebuildIndexForce();

    // Verify index stats after creation
    const afterCreation = await fileManager.scanPrompts();
    assert.strictEqual(
      afterCreation.rootPrompts.length,
      baselineCount + promptNames.length,
      "File count should increase by number of created prompts"
    );

    // Delete some prompts
    for (let i = 0; i < 2; i++) {
      const result = await fileManager.deletePromptFile(createdPaths[i]);
      assert.ok(result);
    }

    // Force rebuild after deletions
    await fileManager.rebuildIndexForce();

    // Verify index stats after deletion
    const afterDeletion = await fileManager.scanPrompts();
    assert.strictEqual(
      afterDeletion.rootPrompts.length,
      baselineCount + 1, // baseline + 3 created - 2 deleted = baseline + 1
      "File count should reflect deletions"
    );

    // Clean up remaining prompt
    const finalResult = await fileManager.deletePromptFile(createdPaths[2]);
    assert.ok(finalResult);

    // Force rebuild after final cleanup
    await fileManager.rebuildIndexForce();

    // Verify back to baseline
    const final = await fileManager.scanPrompts();
    assert.strictEqual(
      final.rootPrompts.length,
      baselineCount,
      "File count should return to baseline after cleanup"
    );
  });

  test("should handle search integration correctly", async () => {
    // Create test prompts with specific content
    const prompt1 = await fileManager.createPromptFile("search-test-1");
    const prompt2 = await fileManager.createPromptFile("search-test-2");
    assert.ok(prompt1 && prompt2);

    // Write searchable content
    await fileSystemManager.writeFile(
      prompt1!,
      "# Search Test 1\n\nThis is a testing prompt."
    );
    await fileSystemManager.writeFile(
      prompt2!,
      "# Search Test 2\n\nThis is a different prompt."
    );

    // Force rebuild index and clear search cache to ensure fresh data
    await fileManager.rebuildIndexForce();
    searchService.clearCache();

    // Small delay to ensure indexing completes
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Test search functionality
    const titleResults = await searchService.searchInTitles("Search Test", {
      fuzzy: undefined,
    });
    assert.ok(
      titleResults.length >= 2,
      `Should find both test prompts by title, but found ${titleResults.length}`
    );

    const contentResults = await searchService.searchInContent("testing", {
      fuzzy: undefined,
    });
    assert.ok(
      contentResults.length >= 1,
      `Should find prompt with 'testing' in content, but found ${contentResults.length}`
    );

    // Clean up
    await fileManager.deletePromptFile(prompt1!);
    await fileManager.deletePromptFile(prompt2!);
    await fileManager.rebuildIndexForce();
  });
});
