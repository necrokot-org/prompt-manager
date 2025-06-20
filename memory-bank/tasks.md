# TASKS - Active Task Management

## Status: 🚧 ACTIVE - Environment-Aware AI Chat Button Toggle (Level 1)

### 🆕 Current Task

**Task ID**: ai-chat-button-gating-20250619  
**Title**: Environment-Aware AI Chat Button Toggle  
**Complexity**: Level 1 – Quick Enhancement  
**Start Date**: 2025-06-19

#### Objective

Add environment-aware gating to the inline "Ask AI" button so it is displayed only in editors that support the Chat panel (initially VS Code).

#### Requirements

1. Leverage existing environment context keys (`promptManager.isVSCode`, `promptManager.isCursor`, `promptManager.isWindserf`, `promptManager.isUnknown`).
2. Update the `package.json` menu contribution for `promptManager.askAiWithPrompt` with a `when` clause such as:  
   `view == promptManagerTree && viewItem == promptFile && promptManager.isVSCode`
3. Ensure the command remains functional in VS Code and that the button is hidden in other environments.
4. Add/adjust unit or integration tests to validate visibility logic.

#### 🎨 Creative Phase Decision

**Design Approach**: Simple When Clause Addition

- **Selected Solution**: Add declarative `when` clause to existing menu contribution in `package.json`
- **Rationale**: Minimal complexity, leverages existing infrastructure, follows VS Code patterns
- **Implementation**: Update menu contribution with `when: "view == promptManagerTree && viewItem == promptFile && promptManager.isVSCode"`

#### 🚀 Implementation Summary

**Changes Made**:

1. **package.json**: Updated menu contribution for `promptManager.askAiWithPrompt` with environment-aware `when` clause
2. **Tests**: Added verification test (`package-menu-visibility.test.ts`) to ensure correct menu configuration
3. **Documentation**: Updated CHANGELOG.md with feature description

**Files Modified**:

- `package.json` (line 127): Added `&& promptManager.isVSCode` to when clause
- `CHANGELOG.md`: Added entry for environment-aware button visibility
- `src/test/package-menu-visibility.test.ts`: New test file for verification

**Verification Results**:

- ✅ Type checking passed
- ✅ Linting passed
- ✅ Build compilation successful
- ✅ Manual verification confirmed correct menu configuration

#### Deliverables

- Modified `package.json` ✅ (Complete)
- Added/updated tests ✅ (Complete)
- Documentation & CHANGELOG entry ✅ (Complete)
- Reflection document (`memory-bank/reflection/reflection-ai-chat-button-gating.md`)

#### Acceptance Criteria

- Inline button visible only in VS Code; hidden in Cursor, Windserf, and Unknown environments.
- Clicking the button opens the Chat panel and inserts the selected prompt.
- All CI checks (type check, lint, build) pass.

<!-- ... existing code ... -->

**Last Completed Task**: GitHub CI Pipeline Setup (Level 2) – Completed & Archived 2025-06-19

## Archive References

**Latest Archived Task**: [docs/archive/archive-github-ci-pipeline-20250619.md](../docs/archive/archive-github-ci-pipeline-20250619.md)
