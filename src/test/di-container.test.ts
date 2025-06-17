import * as assert from "assert";
import * as vscode from "vscode";
import {
  configureDependencies,
  resolve,
  disposeDependencies,
} from "../core/di-container";
import { DI_TOKENS } from "../core/di-tokens";
import { ConfigurationService } from "../config";
import { FileSystemManager } from "../core/FileSystemManager";
import { FileManager } from "../fileManager";
import { PromptTreeProvider } from "../promptTreeProvider";

suite("DI Container Test Suite", () => {
  let mockContext: vscode.ExtensionContext;

  suiteSetup(() => {
    // Create a mock extension context for testing
    mockContext = {
      subscriptions: [],
      workspaceState: {
        get: () => undefined,
        update: () => Promise.resolve(),
        keys: () => [],
      },
      globalState: {
        get: () => undefined,
        update: () => Promise.resolve(),
        keys: () => [],
        setKeysForSync: () => {},
      },
      extensionUri: vscode.Uri.file("/test"),
      extensionPath: "/test",
      environmentVariableCollection: {} as any,
      asAbsolutePath: (path: string) => `/test/${path}`,
      storageUri: vscode.Uri.file("/test/storage"),
      storagePath: "/test/storage",
      globalStorageUri: vscode.Uri.file("/test/global"),
      globalStoragePath: "/test/global",
      logUri: vscode.Uri.file("/test/log"),
      logPath: "/test/log",
      extensionMode: vscode.ExtensionMode.Test,
      extension: {} as any,
      secrets: {} as any,
      languageModelAccessInformation: {} as any,
    };

    // Configure dependencies with mock context
    configureDependencies(mockContext);
  });

  suiteTeardown(() => {
    disposeDependencies();
  });

  test("ConfigurationService should be resolvable", () => {
    const configService = resolve<ConfigurationService>(
      DI_TOKENS.ConfigurationService
    );
    assert.ok(configService, "ConfigurationService should be resolved");
    assert.ok(
      configService instanceof ConfigurationService,
      "Should be instance of ConfigurationService"
    );
  });

  test("FileSystemManager should be resolvable", () => {
    const fileSystemManager = resolve<FileSystemManager>(
      DI_TOKENS.FileSystemManager
    );
    assert.ok(fileSystemManager, "FileSystemManager should be resolved");
    assert.ok(
      fileSystemManager instanceof FileSystemManager,
      "Should be instance of FileSystemManager"
    );
  });

  test("FileManager should be resolvable with injected dependencies", () => {
    const fileManager = resolve<FileManager>(DI_TOKENS.FileManager);
    assert.ok(fileManager, "FileManager should be resolved");
    assert.ok(
      fileManager instanceof FileManager,
      "Should be instance of FileManager"
    );

    // Verify that FileManager has properly injected FileSystemManager
    const fileSystemManager = fileManager.getFileSystemManager();
    assert.ok(fileSystemManager, "FileManager should have FileSystemManager");
    assert.ok(
      fileSystemManager instanceof FileSystemManager,
      "Should be instance of FileSystemManager"
    );
  });

  test("PromptTreeProvider should be resolvable with injected dependencies", () => {
    const treeProvider = resolve<PromptTreeProvider>(
      DI_TOKENS.PromptTreeProvider
    );
    assert.ok(treeProvider, "PromptTreeProvider should be resolved");
    assert.ok(
      treeProvider instanceof PromptTreeProvider,
      "Should be instance of PromptTreeProvider"
    );
  });

  test("ConfigurationService methods should work", () => {
    const configService = resolve<ConfigurationService>(
      DI_TOKENS.ConfigurationService
    );

    // Test that all methods are available and return reasonable defaults
    const defaultDir = configService.getDefaultPromptDirectory();
    assert.ok(
      typeof defaultDir === "string",
      "getDefaultPromptDirectory should return string"
    );

    const namingPattern = configService.getFileNamingPattern();
    assert.ok(
      typeof namingPattern === "string",
      "getFileNamingPattern should return string"
    );

    const showDescription = configService.getShowDescriptionInTree();
    assert.ok(
      typeof showDescription === "boolean",
      "getShowDescriptionInTree should return boolean"
    );
  });

  test("FileSystemManager should work with injected ConfigurationService", () => {
    const fileSystemManager = resolve<FileSystemManager>(
      DI_TOKENS.FileSystemManager
    );

    // Test that FileSystemManager can use ConfigurationService
    // Note: getPromptManagerPath() may return undefined in test environment without workspace
    const promptPath = fileSystemManager.getPromptManagerPath();
    assert.ok(
      promptPath === undefined || typeof promptPath === "string",
      "getPromptManagerPath should return string or undefined"
    );
  });

  test("All services should be singletons", () => {
    // Resolve the same service multiple times and verify they're the same instance
    const configService1 = resolve<ConfigurationService>(
      DI_TOKENS.ConfigurationService
    );
    const configService2 = resolve<ConfigurationService>(
      DI_TOKENS.ConfigurationService
    );
    assert.strictEqual(
      configService1,
      configService2,
      "ConfigurationService should be singleton"
    );

    const fileSystemManager1 = resolve<FileSystemManager>(
      DI_TOKENS.FileSystemManager
    );
    const fileSystemManager2 = resolve<FileSystemManager>(
      DI_TOKENS.FileSystemManager
    );
    assert.strictEqual(
      fileSystemManager1,
      fileSystemManager2,
      "FileSystemManager should be singleton"
    );

    const fileManager1 = resolve<FileManager>(DI_TOKENS.FileManager);
    const fileManager2 = resolve<FileManager>(DI_TOKENS.FileManager);
    assert.strictEqual(
      fileManager1,
      fileManager2,
      "FileManager should be singleton"
    );
  });
});
