import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export interface MockWorkspaceSetup {
  tempDir: string;
  testPromptPath: string;
  cleanup: () => Promise<void>;
}

/**
 * Creates a temporary directory for testing
 */
export async function createTempDirectory(
  testPrefix: string = "prompt-manager-test-"
): Promise<string> {
  return fs.mkdtempSync(path.join(os.tmpdir(), testPrefix));
}

/**
 * Cleans up a temporary directory
 */
export async function cleanupTempDirectory(tempDir: string): Promise<void> {
  await fs.promises.rm(tempDir, { recursive: true, force: true });
}

/**
 * Sets up a mock workspace with temporary directory and vscode.workspace mocking
 * for testing purposes. This extracts the common setup code used across multiple test suites.
 *
 * @param testPrefix - Prefix for the temporary directory name (e.g., "prompt-manager-test-")
 * @returns Object containing tempDir, testPromptPath, and cleanup function
 */
export async function setupMockWorkspace(
  testPrefix: string = "prompt-manager-test-"
): Promise<MockWorkspaceSetup> {
  // Create temporary directory for testing
  const tempDir = await createTempDirectory(testPrefix);
  const testPromptPath = path.join(tempDir, ".prompt_manager");

  // Mock workspace configuration
  const mockConfig = {
    get: (key: string, defaultValue: any) => {
      if (key === "defaultPromptDirectory") {
        return ".prompt_manager";
      }
      return defaultValue;
    },
  };

  // Mock vscode.workspace
  (vscode.workspace as any).getConfiguration = () => mockConfig;
  Object.defineProperty(vscode.workspace, "workspaceFolders", {
    value: [{ uri: { fsPath: tempDir } }],
    configurable: true,
  });

  // Create test directory structure
  await fs.promises.mkdir(testPromptPath, { recursive: true });

  // Return setup information and cleanup function
  return {
    tempDir,
    testPromptPath,
    cleanup: async () => {
      await cleanupTempDirectory(tempDir);
    },
  };
}

/**
 * Creates a simple mock extension URI for tests that need it
 */
export function createMockExtensionUri(
  mockPath: string = "/mock/extension/path"
): vscode.Uri {
  return vscode.Uri.file(mockPath);
}

/**
 * Creates standard test files in the provided prompt directory
 * This is a basic set of test files that can be used across multiple test suites
 */
export async function createStandardTestFiles(
  promptPath: string
): Promise<void> {
  // Test file with YAML front matter
  const promptWithYaml = [
    "---",
    'title: "Test Prompt"',
    'description: "A test prompt for search functionality"',
    'tags: ["testing", "search"]',
    'category: "development"',
    "---",
    "",
    "This is the main content of the test prompt.",
    "It contains some JavaScript code:",
    "",
    "```javascript",
    "function searchExample() {",
    '    return "Hello World";',
    "}",
    "```",
    "",
    "And some more text for testing search functionality.",
  ].join("\n");

  await fs.promises.writeFile(
    path.join(promptPath, "test-prompt.md"),
    promptWithYaml
  );

  // Test file without YAML front matter
  const promptWithoutYaml = [
    "# Simple Prompt",
    "",
    "This is a simple prompt without YAML front matter.",
    "It should still be searchable by content.",
    "",
    "Keywords: database, query, SQL",
  ].join("\n");

  await fs.promises.writeFile(
    path.join(promptPath, "simple-prompt.md"),
    promptWithoutYaml
  );

  // Test file with special characters
  const promptSpecialChars = [
    "---",
    'title: "Special Characters Test"',
    'description: "Testing with special chars: @#$%^&*()"',
    'tags: ["special", "characters"]',
    "---",
    "",
    "This content has special characters: !@#$%^&*()",
    "And unicode: 你好世界 🚀 🔍",
    "RegExp chars: [.*+?^${}()|[]\\]",
  ].join("\n");

  await fs.promises.writeFile(
    path.join(promptPath, "special-chars.md"),
    promptSpecialChars
  );

  // Create a folder with prompts
  const folderPath = path.join(promptPath, "subfolder");
  await fs.promises.mkdir(folderPath);

  const folderPrompt = [
    "---",
    'title: "Folder Prompt"',
    'description: "A prompt inside a folder"',
    'tags: ["folder", "nested"]',
    "---",
    "",
    "Content inside a folder for testing hierarchical search.",
  ].join("\n");

  await fs.promises.writeFile(
    path.join(folderPath, "folder-prompt.md"),
    folderPrompt
  );
}
