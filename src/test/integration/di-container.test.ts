import * as assert from "assert";
import * as vscode from "vscode";
import {
  setupDependencyInjection,
  container,
} from "../../infrastructure/di/di-container";
import { DI_TOKENS } from "../../infrastructure/di/di-tokens";
import { ConfigurationService } from "../../infrastructure/config/config";
import { FileSystemManager } from "../../infrastructure/fs/FileSystemManager";
import { EnvironmentDetector } from "../../infrastructure/config/EnvironmentDetector";
import { PromptApp } from "../../application/PromptApp";
import { TagApp } from "../../application/TagApp";
import { SearchApp } from "../../application/SearchApp";

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
    setupDependencyInjection(mockContext);
  });

  suiteTeardown(() => {
    // Clear container instances
    container.clearInstances();
  });

  test("ConfigurationService should be resolvable", () => {
    const configService = container.resolve<ConfigurationService>(
      DI_TOKENS.ConfigurationService
    );
    assert.ok(configService, "ConfigurationService should be resolved");
    assert.ok(
      configService instanceof ConfigurationService,
      "Should be instance of ConfigurationService"
    );
  });

  test("EnvironmentDetector should be resolvable", () => {
    const envDetector = container.resolve<EnvironmentDetector>(
      DI_TOKENS.EnvironmentDetector
    );
    assert.ok(envDetector, "EnvironmentDetector should be resolved");
    assert.ok(
      envDetector instanceof EnvironmentDetector,
      "Should be instance of EnvironmentDetector"
    );

    // Test that it can detect environment (should work with real vscode.env)
    const environment = envDetector.getEnvironment();
    assert.ok(
      typeof environment === "string",
      "getEnvironment should return string"
    );
  });

  test("FileSystemManager should be resolvable", () => {
    const fileSystemManager = container.resolve<FileSystemManager>(
      DI_TOKENS.FileSystemManager
    );
    assert.ok(fileSystemManager, "FileSystemManager should be resolved");
    assert.ok(
      fileSystemManager instanceof FileSystemManager,
      "Should be instance of FileSystemManager"
    );
  });

  test("PromptApp should be resolvable with injected dependencies", () => {
    const promptApp = container.resolve<PromptApp>(DI_TOKENS.PromptApp);
    assert.ok(promptApp, "PromptApp should be resolved");
    assert.ok(
      promptApp instanceof PromptApp,
      "Should be instance of PromptApp"
    );
  });

  test("TagApp should be resolvable with injected dependencies", () => {
    const tagApp = container.resolve<TagApp>(DI_TOKENS.TagApp);
    assert.ok(tagApp, "TagApp should be resolved");
    assert.ok(tagApp instanceof TagApp, "Should be instance of TagApp");
  });

  test("SearchApp should be resolvable with injected dependencies", () => {
    const searchApp = container.resolve<SearchApp>(DI_TOKENS.SearchApp);
    assert.ok(searchApp, "SearchApp should be resolved");
    assert.ok(
      searchApp instanceof SearchApp,
      "Should be instance of SearchApp"
    );
  });

  test("ConfigurationService methods should work", () => {
    const configService = container.resolve<ConfigurationService>(
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
    const fileSystemManager = container.resolve<FileSystemManager>(
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
    const configService1 = container.resolve<ConfigurationService>(
      DI_TOKENS.ConfigurationService
    );
    const configService2 = container.resolve<ConfigurationService>(
      DI_TOKENS.ConfigurationService
    );
    assert.strictEqual(
      configService1,
      configService2,
      "ConfigurationService should be singleton"
    );

    const fileSystemManager1 = container.resolve<FileSystemManager>(
      DI_TOKENS.FileSystemManager
    );
    const fileSystemManager2 = container.resolve<FileSystemManager>(
      DI_TOKENS.FileSystemManager
    );
    assert.strictEqual(
      fileSystemManager1,
      fileSystemManager2,
      "FileSystemManager should be singleton"
    );

    const promptApp1 = container.resolve<PromptApp>(DI_TOKENS.PromptApp);
    const promptApp2 = container.resolve<PromptApp>(DI_TOKENS.PromptApp);
    assert.strictEqual(promptApp1, promptApp2, "PromptApp should be singleton");

    const tagApp1 = container.resolve<TagApp>(DI_TOKENS.TagApp);
    const tagApp2 = container.resolve<TagApp>(DI_TOKENS.TagApp);
    assert.strictEqual(tagApp1, tagApp2, "TagApp should be singleton");

    const envDetector1 = container.resolve<EnvironmentDetector>(
      DI_TOKENS.EnvironmentDetector
    );
    const envDetector2 = container.resolve<EnvironmentDetector>(
      DI_TOKENS.EnvironmentDetector
    );
    assert.strictEqual(
      envDetector1,
      envDetector2,
      "EnvironmentDetector should be singleton"
    );
  });
});
