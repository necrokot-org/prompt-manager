# Prompt-Manager — Comprehensive Test-Coverage Improvement Plan  
*Author: AI assistant*  
*Version: v1 – 2025-06-21*

---

## 0. Objective

Raise automated test coverage from ~55 % to **≥ 80 %** while increasing scenario depth for critical components.  
The plan is broken into **“Fix”, “Expand”, “Add”, “Infra”** task groups with step-by-step instructions suitable for prompt-driven code generation (Claude 4 or similar).

---

## 1. Fix (Repair / reactivate existing suites)

| ID | File | Issue | Actions |
|----|------|-------|---------|
| **F-1** | `src/test/searchService.test.ts.disabled` | Disabled & outdated import paths | 1. Rename to `searchService.test.ts` (remove “.disabled”).<br>2. Update imports:<br>&nbsp;&nbsp;• `../fileManager` → `@features/prompt-manager/data/fileManager`<br>&nbsp;&nbsp;• `../searchService` → `@features/search/services/searchService`<br>&nbsp;&nbsp;• `../searchPanelProvider` → `@features/search/ui/SearchPanelProvider`<br>3. Update helper path to `@test/helpers`.<br>4. Ensure `setupMockWorkspace` returns correct mocked `vscode.workspace`.<br>5. Run `npm test` to verify re-activation. |
| **F-2** | `src/test/utils/promptFile.test.ts` | Deep import of implementation type | Replace<br>`import { PromptFile } from "../../core/DirectoryScanner";`<br>with<br>`import { PromptFile } from "@root/scanner/types";` |
| **F-3** | `src/test/promptTreeProvider.test.ts` | Mock lacks new `moveFolder` method → promise rejection | Add stub to `mockFileSystemManager`:<br>```ts\nmoveFolder: () => Promise.resolve(),\n``` |
| **F-4** | `src/test/package-menu-visibility.test.ts` | Brittle equality on “when” clause | Change assertion to *contains* required tokens instead of strict equality.<br>```ts\nassert.match(askAiMenuItem.when, /promptManager\\.isVSCode/);\n``` |

---

## 2. Expand (Deepen existing coverage)

### E-1 Integration Flow Test
File: `src/test/integration-flow.test.ts` (new)

1. **Setup** mock workspace via `setupMockWorkspace`.  
2. **Scenario**  
   a. Call `PromptController.createNewPrompt()` → verify emitted `filesystem.file.created` event & tree refresh.  
   b. Execute `CommandHandler.copyPromptContent` → assert clipboard interaction (mock `vscode.env.clipboard`).  
   c. Delete prompt → ensure cache invalidated and tree refresh triggered.  
3. **Assertions**  
   • EventBus payload correctness  
   • `DirectoryScanner` index stats (should decrement file count)  

### E-2 PromptTreeProvider Drag-&-Drop Edge Cases
Add to existing `promptTreeProvider.test.ts`:

1. Drop folder onto **itself** → expect error message (mock `vscode.window.showErrorMessage`).  
2. Drop file into folder with conflicting name → expect rejection path.

Use `sinon.useFakeTimers()` to advance time and ensure `forceRebuildIndex()` debounce path executes.

---

## 3. Add (New dedicated suites)

| New Suite | Path | Focus & Key Cases |
|-----------|------|-------------------|
| **S-1 DirectoryScanner** | `src/test/directoryScanner.test.ts` | • Verify `scanPrompts()` hierarchy ✓<br>• Respect `excludePatterns`, `maxDepth` ✓<br>• `IndexCache` debounce: invalidate → await → index rebuild ✓ (use fake timers) |
| **S-2 SearchEngine** | `src/test/searchEngine.test.ts` | Pure algorithmic tests (no FS):<br>• Exact vs fuzzy, threshold, wildcard<br>• Case sensitivity<br>• Score ordering & snippet extraction |
| **S-3 CommandHandler** | `src/test/commandHandler.test.ts` | Mock `PromptController` + `vscode` commands:<br>• Each registered command fires correct controller method<br>• Error handling path (controller throws) shows `showErrorMessage` |
| **S-4 ConfigurationService** | `src/test/configurationService.test.ts` | • Emits `config.changed` event on VS Code configuration update<br>• DEBUG_LOGGING toggle actually sets flag in `log` module (spy) |
| **S-5 Environment Context Keys** | `src/test/environmentContextKeys.test.ts` | Pass fake `EnvironmentDetector` implementations into `activate()` and assert VS Code context keys via `setContext` spy. |

---

## 4. Infra (Testing infrastructure enhancements)

1. **Central VS Code Mocks**  
   Create `test/__mocks__/vscode.ts` exporting a fully typed stub; use Jest / ts-node register mapping to replace during tests.

2. **Coverage**  
   Integrate `nyc` (Istanbul) in `package.json` test script:  
   ```json
   "scripts": { "test": "nyc --reporter=lcov mocha -r ts-node/register src/test/**/*.test.ts" }
   ```
   Add coverage threshold check: `"check-coverage": "nyc check-coverage --lines 80 --functions 80"`.

3. **Fake Timers Helper**  
   Add `test/fakeTimers.ts` exporting `withFakeTimers(async cb)` wrapper to DRY use of `sinon`.

4. **Disabled-test policy**  
   Replace “.disabled” filenames with `it.skip` or `describe.skip` to keep suites discoverable by reporters.

---

## 5. Task Breakdown & Estimation

| Task ID | Effort | Dependent On |
|---------|--------|--------------|
| F-1..F-4 | 1 d | none |
| E-1 | 0.5 d | F-1 |
| E-2 | 0.5 d | F-3 |
| S-1 | 0.5 d | F-1 |
| S-2 | 0.5 d | none |
| S-3 | 0.5 d | F-3 |
| S-4 | 0.25 d | none |
| S-5 | 0.25 d | DI container refactor stable |
| Infra-1..4 | 1 d | parallel |

**Total ≈ 5 days** (single dev)  

---

## 6. Acceptance Criteria

1. **npm run test** passes on CI without `--bail`.  
2. `nyc` report shows **≥ 80 % lines & functions**.  
3. No suites remain disabled or silently skipped (except VS-Code integration tests behind env flag).  
4. All new suites documented with inline comments following style-guide.

---

## 7. Deliverables

- Updated / new test files per sections 1-3.  
- `test/__mocks__/vscode.ts`, `test/fakeTimers.ts`.  
- `nyc` config & updated `package.json` scripts.  
- Short CHANGELOG entry summarising coverage improvements.

---

*End of plan*