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

## Extension Settings

Include if your extension adds any VS Code settings through the `contributes.configuration` extension point.

For example:

This extension contributes the following settings:

- `myExtension.enable`: Enable/disable this extension.
- `myExtension.thing`: Set to `blah` to do something.

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

**Enjoy!**
