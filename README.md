# Prompt Manager

[![CI](https://github.com/yourusername/prompt-manager/workflows/CI/badge.svg)](https://github.com/yourusername/prompt-manager/actions)

This is a VSCode extension for managing prompts with tree view organization and file management capabilities.

## Features

Describe specific features of your extension including screenshots of your extension in action. Image paths are relative to this README file.

For example if there is an image subfolder under your extension project workspace:

\!\[feature X\]\(images/feature-x.png\)

> Tip: Many popular extensions utilize animations. This is an excellent way to show off your extension! We recommend short, focused animations that are easy to follow.

## Requirements

If you have any requirements or dependencies, add a section describing those and how to install and configure them.

## Environment Detection

This extension automatically detects the host editor environment at runtime and adapts its behavior accordingly. **No user configuration is required.**

### Supported Environments

- **VS Code** (Microsoft Visual Studio Code)
- **Cursor** (Cursor AI IDE)
- **Windsurf** (Windsurf IDE)
- **Unknown** (Any other VS Code-compatible editor)

### Detection Logic

The extension uses a **two-tier detection approach** with word-boundary matching to prevent false positives:

1. **Primary Detection**: `vscode.env.appHost` (most reliable)
2. **Fallback Detection**: `vscode.env.appName` (legacy compatibility)
3. **Unknown Fallback**: If no matches found, shows user warning

```typescript
// Detection priority examples:
vscode.env.appHost = "cursor-app"     → Environment.Cursor
vscode.env.appHost = "windsurf-host"  → Environment.Windserf
vscode.env.appName = "Visual Studio Code" → Environment.VSCode
vscode.env.appName = "Unknown Editor" → Environment.Unknown (+ warning)
```

### Word-Boundary Protection

The detection uses regex word boundaries to avoid false matches:

- `"precursor"` → **Unknown** (not Cursor)
- `"my-cursor-editor"` → **Cursor** ✓
- `"excursion"` → **Unknown** (not Cursor)

### Caching & Performance

- Detection occurs **once at extension startup**
- Results are **cached** for O(1) subsequent access
- **No runtime performance impact**

### Feature Gating

Environment detection enables conditional features:

```typescript
// Available context keys for package.json "when" clauses:
"promptManager.isVSCode"; // true only in VS Code
"promptManager.isCursor"; // true only in Cursor
"promptManager.isWindserf"; // true only in Windsurf
"promptManager.isUnknown"; // true for unrecognized editors
```

Example usage in `package.json`:

```json
{
  "command": "promptManager.askAiWithPrompt",
  "when": "view == promptManagerTree && viewItem == promptFile && promptManager.isVSCode"
}
```

## Extension Settings

This extension contributes the following settings:

## Known Issues

Calling out known issues can help limit users opening duplicate issues against your extension.

## Release Notes

Users appreciate release notes as you update your extension.

### 1.0.0

Initial release of ...

### 1.0.1

Fixed issue #.

### 1.1.0

Added features X, Y, and Z.

---

## Following extension guidelines

Ensure that you've read through the extensions guidelines and follow the best practices for creating your extension.

- [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## Working with Markdown

You can author your README using Visual Studio Code. Here are some useful editor keyboard shortcuts:

- Split the editor (`Cmd+\` on macOS or `Ctrl+\` on Windows and Linux).
- Toggle preview (`Shift+Cmd+V` on macOS or `Shift+Ctrl+V` on Windows and Linux).
- Press `Ctrl+Space` (Windows, Linux, macOS) to see a list of Markdown snippets.

## For more information

- [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
- [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

## 📁 Architecture Update – June 2025

The `vscode-prompt-manager` code‐base has undergone a **major internal refactor** to split several "mega classes" into focused, testable components.  
There are **no public API changes**, only _internal_ package boundaries. Extension users are unaffected, but contributors should be aware of the new layout.

### Scanner layer (`src/scanner/*`)

| Responsibility                                 | Former location                   | New module                                 |
| ---------------------------------------------- | --------------------------------- | ------------------------------------------ |
| File traversal & Markdown front-matter parsing | `core/DirectoryScanner.ts`        | `scanner/FilesystemWalker.ts`              |
| Grouping flat file list into `PromptStructure` | `core/DirectoryScanner.ts`        | `scanner/PromptOrganizer.ts`               |
| In-memory cache & debounce logic               | `core/DirectoryScanner.ts`        | `scanner/IndexCache.ts`                    |
| Orchestration facade                           | `core/DirectoryScanner.ts` (kept) | `core/DirectoryScanner.ts` (now delegates) |

### Tree-view layer (`src/tree/*`)

| Responsibility                        | Former location                | New module                             |
| ------------------------------------- | ------------------------------ | -------------------------------------- |
| `TreeItem` implementations            | `promptTreeProvider.ts`        | `tree/items/*`                         |
| Search matching logic                 | `promptTreeProvider.ts`        | `tree/filter/SearchFilter.ts`          |
| Centralised factory for item creation | `promptTreeProvider.ts`        | `tree/factory/ItemFactory.ts`          |
| Tree provider orchestration           | `promptTreeProvider.ts` (kept) | `promptTreeProvider.ts` (now composes) |

### Why this matters

1. **Targeted unit testing** – each class now has a single responsibility and can be mocked in isolation.
2. **Easier onboarding** – newcomers can focus on a small slice of the code-base without scrolling through 400-line files.
3. **Extensibility** – future features (e.g. virtualised trees, remote FS scanning) can be implemented by swapping in an alternative module rather than rewriting the world.

### Migration notes for maintainers

- `DirectoryScanner` continues to export `PromptFile`, `PromptFolder`, and related types for backwards compatibility—no import paths need to change.
- If you need a new `TreeItem`, add it under `src/tree/items/` and register it in `src/tree/items/index.ts`.
- Keep constructor logic _thin_; heavy lifting belongs in collaborators.  
  When a class grows beyond ~200 LOC, consider spinning out a helper.

Happy hacking! 💻

## 🧪 Test Infrastructure

The extension uses a comprehensive test infrastructure with the following components:

### VS Code Mock System

All tests run with a complete VS Code API mock that eliminates dependencies on the actual VS Code editor:

- **Location**: `test/__mocks__/vscode.ts`
- **Automatic replacement**: VS Code imports are automatically redirected to the mock during test execution
- **Full API coverage**: Covers `commands`, `window`, `workspace`, `Uri`, `TreeView`, and all other APIs used by the extension
- **Typed interfaces**: Maintains TypeScript compatibility with proper type checking

### Code Coverage

Code coverage is enforced via [nyc](https://github.com/istanbuljs/nyc) (Istanbul):

```bash
# Run tests with coverage
npm test

# Check coverage thresholds
npm run check-coverage
```

**Coverage Requirements:**
- Lines: ≥80%
- Functions: ≥80%
- Branches: ≥70%
- Statements: ≥80%

Coverage reports are generated in `coverage/` directory and uploaded as CI artifacts.

### Fake Timers Helper

For tests involving debounced operations or timeouts, use the `withFakeTimers` helper:

```typescript
import { withFakeTimers } from './fakeTimers';

it('debounces refresh calls', () =>
  withFakeTimers(async (clock) => {
    // Your test code here
    controller.refresh();
    clock.tick(300); // Advance time by 300ms
    expect(spy.calledOnce).to.be.true;
  }));
```

This helper automatically:
- Sets up sinon fake timers before your test
- Passes the clock instance to your test function
- Restores real timers after test completion (even if test fails)

### Running Tests

```bash
# Run all tests with coverage
npm test

# Run tests for VS Code extension (integration tests)
npm run test:vscode

# Check coverage thresholds
npm run check-coverage

# Compile tests only
npm run compile-tests
```

### Test Files Structure

- `src/test/**/*.test.ts` - All test files
- `src/test/helpers.ts` - Common test utilities and workspace setup
- `src/test/fakeTimers.ts` - Fake timers helper utility
- `src/test/setup.ts` - Test environment bootstrap (VS Code mocking, path resolution)
- `test/__mocks__/vscode.ts` - Complete VS Code API mock

### CI Integration

The GitHub Actions CI pipeline:
1. Runs type checking (`npm run check-types`)
2. Runs linting (`npm run lint`)
3. Executes all tests with coverage (`npm test`)
4. **Enforces coverage thresholds** - pipeline fails if coverage drops below requirements
5. Uploads coverage reports as artifacts
6. Builds the extension package

**Enjoy!**
