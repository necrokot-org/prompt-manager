# Task: VSCode Prompt Manager Extension

## Description

Create a comprehensive VSCode extension to manage prompts for LLMs with:

1. Custom extension UI with tree view
2. Local storage in `.prompt_manager` directory
3. Prompt organization and management
4. Editor integration for opening files
5. Add new prompt functionality

## Complexity

Level: 3 (Intermediate Feature)
Type: VSCode Extension with UI Components, File Management, and User Interactions

## Technology Stack

- Framework: VSCode Extension API
- Language: TypeScript
- Build Tool: ESBuild (already configured)
- UI Components: VSCode TreeView API, Custom Webview Panels
- Storage: File system (`fs` module) for `.prompt_manager` directory
- Configuration: VSCode Settings API

## Technology Validation Checkpoints

- [x] Project initialization command verified (existing extension structure)
- [x] Required dependencies identified (VSCode API, TypeScript)
- [x] Build configuration validated (ESBuild working)
- [ ] VSCode Extension API exploration completed
- [ ] TreeView implementation proof of concept
- [ ] File system operations validated
- [ ] Test build passes successfully

## Requirements Analysis

### Core Requirements

- [ ] **R1**: Create extension-specific UI panel/tab
- [ ] **R2**: Implement tree view for prompt organization
- [ ] **R3**: File system management for `.prompt_manager` directory
- [ ] **R4**: Open files in VSCode editor on click
- [ ] **R5**: Add new prompt functionality with UI button
- [ ] **R6**: Persistent storage and retrieval of prompts

### Technical Constraints

- [ ] **C1**: Must work within VSCode extension sandbox
- [ ] **C2**: File operations limited to workspace scope
- [ ] **C3**: UI must follow VSCode design patterns
- [ ] **C4**: Performance considerations for large prompt collections

## Components Affected

### Core VSCode Extension Components

- **Extension Entry Point** (`extension.ts`)

  - Changes needed: Register TreeDataProvider, commands, webview panels
  - Dependencies: VSCode API, file system operations

- **TreeView Data Provider** (new component)

  - Changes needed: Implement TreeDataProvider interface
  - Dependencies: File system scanning, prompt metadata

- **File Manager** (new component)

  - Changes needed: Create/read/write operations for `.prompt_manager`
  - Dependencies: Node.js `fs` module, path utilities

- **Prompt Manager** (new component)

  - Changes needed: CRUD operations for prompts
  - Dependencies: File Manager, TreeView refresh

- **UI Components** (new webview panels)
  - Changes needed: Add prompt dialog, settings panel
  - Dependencies: VSCode Webview API, HTML/CSS/JS

### Configuration Components

- **Package.json Contributions**
  - Changes needed: Add commands, views, settings
  - Dependencies: VSCode extension manifest schema

## Creative Phases Required

### 🎨 UI/UX Design Phase

- [ ] **UI-1**: Tree view structure and organization design
- [ ] **UI-2**: Add new prompt dialog interface design
- [ ] **UI-3**: File management UI patterns
- [ ] **UI-4**: Integration with VSCode explorer panel

### 🏗️ Architecture Design Phase

- [ ] **ARCH-1**: Extension architecture for modularity
- [ ] **ARCH-2**: File storage structure design
- [ ] **ARCH-3**: Event handling and state management
- [ ] **ARCH-4**: Error handling and user feedback patterns

### ⚙️ Data Management Design Phase

- [ ] **DATA-1**: Prompt metadata schema design
- [ ] **DATA-2**: Directory structure organization
- [ ] **DATA-3**: File naming conventions and indexing
- [ ] **DATA-4**: Search and filtering capabilities

## Implementation Strategy

### Phase 1: Foundation Setup

1. [ ] **IMPL-1.1**: Update package.json with required contributions
2. [ ] **IMPL-1.2**: Implement basic TreeDataProvider class
3. [ ] **IMPL-1.3**: Create file manager utility class
4. [ ] **IMPL-1.4**: Establish `.prompt_manager` directory structure

### Phase 2: Core Functionality

1. [ ] **IMPL-2.1**: Implement prompt scanning and tree population
2. [ ] **IMPL-2.2**: Add file opening functionality via editor commands
3. [ ] **IMPL-2.3**: Create prompt file creation workflow
4. [ ] **IMPL-2.4**: Implement refresh and file watching

### Phase 3: UI Enhancement

1. [ ] **IMPL-3.1**: Design and implement add prompt dialog
2. [ ] **IMPL-3.2**: Add context menu actions for tree items
3. [ ] **IMPL-3.3**: Implement prompt editing and deletion
4. [ ] **IMPL-3.4**: Add search and filtering capabilities

### Phase 4: Polish and Testing

1. [ ] **IMPL-4.1**: Error handling and user feedback
2. [ ] **IMPL-4.2**: Performance optimization for large collections
3. [ ] **IMPL-4.3**: Integration testing with VSCode
4. [ ] **IMPL-4.4**: Documentation and user guide

## Testing Strategy

### Unit Tests

- [ ] **TEST-U1**: File manager operations (create, read, update, delete)
- [ ] **TEST-U2**: TreeDataProvider functionality
- [ ] **TEST-U3**: Prompt metadata parsing and validation
- [ ] **TEST-U4**: Command registration and execution

### Integration Tests

- [ ] **TEST-I1**: TreeView rendering and interaction
- [ ] **TEST-I2**: File opening in VSCode editor
- [ ] **TEST-I3**: Directory creation and management
- [ ] **TEST-I4**: Extension activation and deactivation

### User Acceptance Tests

- [ ] **TEST-UA1**: Complete workflow from adding to opening prompts
- [ ] **TEST-UA2**: Large prompt collection performance
- [ ] **TEST-UA3**: Error scenarios and recovery

## Dependencies

- VSCode Extension API (`vscode` module)
- Node.js File System API (`fs`, `path`)
- TypeScript compilation toolchain
- ESBuild for bundling

## Challenges & Mitigations

### **Challenge 1**: VSCode API Learning Curve

**Mitigation**: Start with comprehensive VSCode extension documentation review and simple TreeView examples

### **Challenge 2**: File System Operations in Extension Context

**Mitigation**: Use VSCode workspace API for safe file operations, implement proper error handling

### **Challenge 3**: UI Design Consistency with VSCode

**Mitigation**: Follow VSCode design patterns, use built-in icons and styling, refer to official extension examples

### **Challenge 4**: Performance with Large Prompt Collections

**Mitigation**: Implement lazy loading, file system watching for updates, and efficient tree refresh strategies

## Status

- [x] Initialization complete
- [x] Planning complete
- [ ] Technology validation complete
- [x] Creative phases complete
- [ ] Implementation phases complete
- [ ] Testing complete
- [ ] Documentation complete

## Next Mode Transition

**Recommended:** IMPLEMENT MODE (Creative phases completed, ready for implementation)
**Reason:** All creative design decisions documented in `memory-bank/creative/creative-prompt-manager-extension.md`

## Current Status

- Phase: Creative Phases Complete
- Status: Ready for Implementation
- Blockers: None identified

## Creative Phase Completion Summary

✅ **UI/UX Design**: VSCode TreeView Panel with native integration patterns  
✅ **Architecture Design**: Layered architecture with component separation  
✅ **Data Management**: File-based structure with YAML front matter metadata

**Design Document**: See `memory-bank/creative/creative-prompt-manager-extension.md` for complete specifications
