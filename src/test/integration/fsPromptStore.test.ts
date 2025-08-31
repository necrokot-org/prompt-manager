import { setup, teardown, suite, test } from "mocha";
import { expect } from "chai";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { FsPromptStore } from "../../infrastructure/prompt/FsPromptStore";
import { FileSystemManager } from "../../infrastructure/fs/FileSystemManager";

suite("FsPromptStore", () => {
  let fsPromptStore: FsPromptStore;
  let mockFileSystem: sinon.SinonStubbedInstance<FileSystemManager>;
  let testPromptPath: string;

  setup(() => {
    // Mock FileSystemManager
    mockFileSystem = sinon.createStubInstance(FileSystemManager);

    // Mock the root path
    mockFileSystem.getPromptManagerPath.returns("/test/prompts");
    mockFileSystem.fileExists.returns(true);
    mockFileSystem.ensurePromptManagerDirectory.resolves(true);

    // Create FsPromptStore instance
    fsPromptStore = new FsPromptStore(mockFileSystem);
    testPromptPath = "/test/prompts";
  });

  teardown(() => {
    sinon.restore();
  });

  test("should return root path correctly", async () => {
    const rootPath = await fsPromptStore.rootPath();
    expect(rootPath).to.equal("/test/prompts");
  });

  test("should create prompt successfully", async () => {
    // Setup mocks
    mockFileSystem.fileExists
      .withArgs("/test/prompts/Test Prompt.md")
      .returns(false);
    mockFileSystem.writeFile.resolves();

    const result = await fsPromptStore.createPrompt("Test Prompt");

    expect(result).to.equal("/test/prompts/Test Prompt.md");
    expect(mockFileSystem.writeFile.calledOnce).to.be.true;
  });

  test("should throw error when prompt already exists", async () => {
    // Setup mocks
    mockFileSystem.fileExists
      .withArgs("/test/prompts/Test Prompt.md")
      .returns(true);

    try {
      await fsPromptStore.createPrompt("Test Prompt");
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect((error as Error).message).to.include("already exists");
    }
  });

  test("should delete prompt successfully", async () => {
    mockFileSystem.deleteFile.resolves();

    await fsPromptStore.deletePrompt("/test/prompts/Test Prompt.md");

    expect(mockFileSystem.deleteFile.calledWith("/test/prompts/Test Prompt.md"))
      .to.be.true;
  });

  test("should create folder successfully", async () => {
    // Setup mocks
    mockFileSystem.fileExists
      .withArgs("/test/prompts/Test Folder")
      .returns(false);
    mockFileSystem.createDirectory.resolves();

    const result = await fsPromptStore.createFolder("Test Folder");

    expect(result).to.equal("/test/prompts/Test Folder");
    expect(
      mockFileSystem.createDirectory.calledWith("/test/prompts/Test Folder")
    ).to.be.true;
  });

  test("should create folder in parent successfully", async () => {
    // Setup mocks
    mockFileSystem.fileExists
      .withArgs("/test/prompts/Parent/Test Folder")
      .returns(false);
    mockFileSystem.createDirectory.resolves();

    const result = await fsPromptStore.createFolder(
      "Test Folder",
      "/test/prompts/Parent"
    );

    expect(result).to.equal("/test/prompts/Parent/Test Folder");
  });

  test("should throw error when folder already exists", async () => {
    // Setup mocks
    mockFileSystem.fileExists
      .withArgs("/test/prompts/Test Folder")
      .returns(true);

    try {
      await fsPromptStore.createFolder("Test Folder");
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect((error as Error).message).to.include("already exists");
    }
  });

  test("should read file content", async () => {
    const testContent = "# Test Prompt\n\nThis is a test prompt.";
    mockFileSystem.readFile.resolves(testContent);

    const content = await fsPromptStore.read("/test/prompts/Test Prompt.md");

    expect(content).to.equal(testContent);
    expect(mockFileSystem.readFile.calledWith("/test/prompts/Test Prompt.md"))
      .to.be.true;
  });

  test("should write file content", async () => {
    const testContent = "# Updated Prompt\n\nUpdated content.";
    mockFileSystem.writeFile.resolves();

    await fsPromptStore.write("/test/prompts/Test Prompt.md", testContent);

    expect(
      mockFileSystem.writeFile.calledWith(
        "/test/prompts/Test Prompt.md",
        testContent
      )
    ).to.be.true;
  });

  test("should move file successfully", async () => {
    mockFileSystem.moveFile.resolves();

    await fsPromptStore.moveFile("/test/source.md", "/test/dest.md");

    expect(
      mockFileSystem.moveFile.calledWith("/test/source.md", "/test/dest.md")
    ).to.be.true;
  });

  test("should move folder successfully", async () => {
    mockFileSystem.moveFile.resolves();

    await fsPromptStore.moveFolder("/test/source", "/test/dest");

    expect(mockFileSystem.moveFile.calledWith("/test/source", "/test/dest")).to
      .be.true;
  });

  test("should check if file exists", async () => {
    mockFileSystem.fileExists.withArgs("/test/file.md").returns(true);
    mockFileSystem.fileExists.withArgs("/test/nonexistent.md").returns(false);

    const exists = await fsPromptStore.exists("/test/file.md");
    const notExists = await fsPromptStore.exists("/test/nonexistent.md");

    expect(exists).to.be.true;
    expect(notExists).to.be.false;
  });

  test("should handle root path not available", async () => {
    mockFileSystem.getPromptManagerPath.returns(undefined);

    try {
      await fsPromptStore.createPrompt("Test");
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect((error as Error).message).to.include("not available");
    }
  });

  test("should handle ensure directory failure", async () => {
    mockFileSystem.ensurePromptManagerDirectory.resolves(false);

    try {
      await fsPromptStore.createPrompt("Test");
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect((error as Error).message).to.include("Failed to ensure");
    }
  });
});
