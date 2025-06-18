# Prompt Manager – Project Style Guide

> Version 0.1 • 2025-06-18  
> The single source of truth for code-style, naming, file layout, testing and documentation conventions.

## 1 General Formatting

1. Use **Prettier** defaults with the following overrides:  
   – printWidth = 100 • tabWidth = 2 • semi = true • singleQuote = false • trailingComma = es5
2. Always run `pnpm exec eslint --fix` (ESLint config already in repo) before committing.
3. One blank line after import block, before first symbol definition.

## 2 Language & TypeScript

1. `"strict": true` (already enforced).
2. Ban `any`; prefer `unknown` + type-narrowing helpers in `src/utils`.
3. Prefer `readonly` arrays/tuples for pure data.
4. Use `interface` for data-shapes, `type` for unions & utility composites.

## 3 Naming Conventions

| Item                 | Convention                       | Example                      |
| -------------------- | -------------------------------- | ---------------------------- |
| Classes & Decorators | PascalCase                       | `PromptController`           |
| Functions/Methods    | camelCase                        | `initializeContainer()`      |
| Variables            | camelCase                        | `promptFiles`                |
| Constants / Enums    | UPPER_SNAKE_CASE                 | `DEFAULT_WORKSPACE_GLOB`     |
| DI Tokens            | `DI_TOKENS.<DescriptiveName>`    | `DI_TOKENS.PromptRepository` |
| File names           | kebab-case                       | `file-tree-item.ts`          |
| Test files           | `<subject>.test.ts` (co-located) | `promptTreeProvider.test.ts` |

## 4 Project Structure & Imports

1. **Feature-based layout** (`src/features/<feature>/domain|ui|data`).
2. **Layering rule** – UI ➜ Domain ➜ Infrastructure; no back-references.
3. Use path aliases defined in `tsconfig.json` (`@features/...`, `@infra/...`).
4. Each folder exporting ≥2 symbols must provide an `index.ts` barrel.
5. Side-effect imports are forbidden outside entry points (`extension.ts`, `esbuild.js`).

## 5 Dependency Injection

1. Always prefer **constructor injection**; avoid field or parameter property injection.
2. Register services in `di-container.ts`; resolution via `resolve<T>(TOKEN)`.
3. Services are **singletons** by default; transient lifetimes must be justified.
4. Production code **never** calls `new FooService()` directly.

## 6 Logging & Error Handling

1. Use `infrastructure/vscode/log.ts`. Levels: `trace < debug < info < warn < error`.
2. Every `catch` must either re-throw **or** call `log.error`.
3. Surface user-visible errors with `vscode.window.showErrorMessage`.

## 7 VS Code Extension Guidelines

1. **Commands** – register once in `commandHandler.ts`, keep identifiers in `src/types/commandIds.ts`.
2. **Disposables** – anything allocating resources must implement `dispose()` and be added to `ExtensionContext.subscriptions`.
3. **Webviews** – sanitize all messages; validate payload with `src/validation`.

## 8 Testing

1. Co-locate tests with sources; use Jest‐like "describe/it" blocks (see current tests).
2. Mock VS Code API with helpers in `src/test/helpers.ts`.
3. Coverage target ≥ 85 % lines per feature; CI will fail below 80 %.
4. Integration tests go under `src/test/integration.test.ts` and run in the VS Code test runner.

## 9 Commit & PR Hygiene

1. Conventional Commits (`feat:`, `fix:`, `chore:` …).
2. Every PR must:  
   – update relevant Memory-Bank docs if behaviour/architecture changes;  
   – pass `npm run compile` and `npm lint`.

## 10 Documentation

1. All exported classes/functions require JSDoc with type links.
2. Diagrams go in `/docs/` as Mermaid.
3. Memory-Bank updates: follow isolation-rule checklist before editing core files.

## 11 Internationalisation & Accessibility

1. UI strings: store in `src/infrastructure/vscode/i18n.ts` (to be created) for future locale support.
2. Provide keyboard access for all panel actions; validate with VS Code accessibility checker.

## 12 Known Limitations / Technical Debt

- TODO: populate via progress.md entries (e.g. "Search index not persisted across sessions").

---

_This Style Guide is living documentation; propose changes via PR titled "docs(style-guide): ..."._
