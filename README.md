# Prompt Manager

Manage your personal or team-wide library of AI prompts **directly inside VS Code, Cursor and any other VS Code-compatible editor.**

Prompt files live in a normal folder inside your workspace (`.prompt_manager/` by default) so they remain **plain-text, version-controlled and shareable**.

---

## 📌 Everyday Workflow

1. **Install** the extension from the Marketplace or a local `.vsix`.
2. **Initialise** your workspace: run **“Prompt Manager: Initialise Workspace”** or simply create a `.prompt_manager/` folder.
3. **Create prompts** (`⌘/Ctrl + N` in the tree or right-click → _New Prompt_):

   ```md
   # .prompt_manager/fix-eslint.md

   ---

   title: Fix ESLint warning
   description: Ask the LLM to explain and fix an ESLint rule violation
   tags: [javascript, eslint]

   ---

   I’m seeing the following ESLint error:
   ```

4. **Browse & organise** prompts in the dedicated _Prompt Manager_ tree view.
5. **Search / filter / copy** whenever you need a prompt — no context-switching required.

---

## ✨ Main Features

- **Tree-view library** – folders & files mirror your on-disk structure
- **YAML front-matter parsing** – `title`, `description`, `tags` & any custom fields
- **Tag filtering** – click to narrow the tree
- **Blazing-fast search** – real-time results powered by FlexSearch
  - case-sensitive, whole-word & fuzzy toggles
  - scope selector: _Titles • Content • All_
- **Clipboard helpers** – copy prompt body with or without metadata
- **Safe CRUD** – create, rename, move & delete with confirmation dialogs
- **Offline-first** – zero external requests; prompts stay on your disk
- **Editor-aware** – automatically adapts to VS Code, Cursor, Windsurf, etc.

---

## 🔍 Search Syntax Cheat-Sheet

| Operator      | Example                                                                 | Meaning                                      |
| :------------ | :---------------------------------------------------------------------- | :------------------------------------------- |
| Space / `AND` | `lint javascript`                                                       | _both_ terms must appear                     |
| `\|` / `OR`   | `lint \| format`                                                        | _either_ term can appear                     |
| `-` / `NOT`   | `javascript -react`                                                     | include _javascript_ but **exclude** _react_ |
| Quotes        | `"error handling"`                                                      | exact phrase match                           |
| Prefix        | `design-sys*`                                                           | wildcard at end (default behaviour)          |
| Whole word    | Toggle **Match Whole Word** to disable prefix matching                  |
| Case          | Toggle **Case Sensitive** to respect letter casing                      |
| Fuzzy         | Toggle **Fuzzy Search** to allow typos (e.g. `javscrpt` → _javascript_) |

Example – find prompts about TypeScript **or** JavaScript, but **not** React, in titles only, case-insensitive:

```text
typescript | javascript -react
```

Set **Scope** to _Titles_ and leave **Case Sensitive** off.

---

Enjoy faster, friction-free prompting — and keep your best prompts right where you code!
