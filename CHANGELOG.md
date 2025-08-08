# Change Log

All notable changes to the "prompt-manager" extension will be documented in this file.

## [1.0.2] - 2025-01-11

### Fixed

- Fixed tag tree not updating after tags were added to file metadata ([#72](https://github.com/necrokot-org/prompt-manager/pull/72))
- Fixed create prompt dialog functionality ([#73](https://github.com/necrokot-org/prompt-manager/pull/73))
- Fixed folder creation via context menu creating folders in root instead of the selected context folder ([#77](https://github.com/necrokot-org/prompt-manager/pull/77))
- Fixed additional bugs related to file changes and updates

### Changed

- Removed markdown title from prompt files created via wizard ([#74](https://github.com/necrokot-org/prompt-manager/pull/74))
- Enhanced metainfo generation with all default fields ([#75](https://github.com/necrokot-org/prompt-manager/pull/75))

## [1.0.1] - 2025-01-05

### Fixed

- Fix README formatting

## [1.0.0] - 2024-12-31

Initial release of Prompt Manager - a VS Code extension for managing AI prompts with tree view organization and powerful search capabilities.

### Features

- **Tree View Library** - Organize prompts in folders mirroring your disk structure
- **YAML Front-matter Support** - Parse `title`, `description`, `tags` and custom fields
- **Tag-based Filtering** - Click tags to filter prompts
- **Advanced Search Engine** - Powered by FlexSearch with real-time results
  - Boolean operators: space/AND, |/OR, -/NOT
  - Exact phrase matching with quotes
  - Case-sensitive and whole-word toggles
  - Fuzzy search with typo tolerance
  - Scope filtering: Titles, Content, or All
- **Clipboard Integration** - Copy prompt content with or without metadata
- **Safe File Operations** - Create, rename, move, delete with confirmation dialogs
- **Multi-editor Support** - Automatically adapts to VS Code, Cursor, Windsurf
- **Offline-first** - All data stays local, no external requests
- **Configurable** - Customize directory name, file naming patterns, tree display

### Commands

- Initialize workspace with `.prompt_manager/` directory
- Create prompts and folders via tree view or commands
- Search with real-time filtering and suggestions
- Copy prompt content to clipboard
- Rename and organize prompts with drag & drop
- Tag management and filtering

### Configuration

- `promptManager.defaultPromptDirectory` - Default directory name (default: `.prompt_manager`)
- `promptManager.fileNamingPattern` - File naming convention (kebab-case, snake_case, original)
- `promptManager.showDescriptionInTree` - Show descriptions in tree view
- `promptManager.debugLogging` - Enable debug logging
