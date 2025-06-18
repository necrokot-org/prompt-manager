# Prompt Manager - VS Code Extension Project Brief

## Project Overview

A sophisticated VSCode extension for managing prompts for LLMs with advanced tree view organization, search capabilities, and comprehensive file management. The extension features a modern architecture with dependency injection, event-driven design, and comprehensive testing.

## Core Features

### Primary Capabilities

- **Advanced Tree View**: Full-featured tree integration with refresh, add, delete, copy operations
- **Search Panel**: Webview-based search with real-time filtering and result counts
- **Prompt Management**: Complete CRUD operations for prompt files and folders
- **Copy Functionality**: One-click copy prompt content to clipboard
- **Directory Management**: Automated prompt directory creation and organization
- **Workspace Integration**: Automatic initialization and workspace change detection

### Advanced Features

- **Event Bus System**: Sophisticated inter-component communication
- **Configuration Management**: Comprehensive settings with runtime updates
- **Search Engine**: Advanced search with fuzzy matching and criteria filtering
- **Dependency Injection**: Full DI container with service resolution
- **Error Handling**: Comprehensive error logging and user feedback

## Technical Architecture

### Modern Extension Architecture

- **Feature-Based Structure**: Modular organization by business capabilities
- **Dependency Injection**: IoC container with singleton service management
- **Event-Driven Design**: Pub/sub communication between components
- **Layered Architecture**: Clear separation between UI, domain, and infrastructure

### Technical Stack

- **Platform:** VS Code Extension API (v1.96.0+)
- **Language:** TypeScript with strict typing
- **Build System:** esbuild with watch mode and production optimizations
- **Testing:** VS Code Test Framework with comprehensive coverage
- **Linting:** ESLint with TypeScript rules
- **Dependencies:**
  - Dependency Injection: reflect-metadata
  - Search: fuse.js, lucene-query-parser
  - File Operations: fs-extra, fast-glob
  - Utilities: lodash-es, gray-matter, lru-cache

## Project Structure

### Core Architecture

- `src/extension/extension.ts` - Main extension entry with DI initialization
- `src/extension/commands/commandHandler.ts` - Centralized command handling

### Feature Modules

- `src/features/prompt-manager/` - Core prompt management functionality
  - `domain/` - Business logic (controllers, repositories)
  - `ui/tree/` - Tree view components and providers
  - `data/` - Data access and file management
- `src/features/search/` - Search functionality
  - `services/` - Search service implementation
  - `ui/` - Search panel webview provider

### Infrastructure Layer

- `src/infrastructure/di/` - Dependency injection container
- `src/infrastructure/config/` - Configuration management
- `src/infrastructure/fs/` - File system abstractions
- `src/infrastructure/vscode/` - VSCode API wrappers

### Supporting Systems

- `src/core/` - Core business abstractions
- `src/scanner/` - File system scanning and indexing
- `src/utils/` - Shared utilities
- `src/validation/` - Input validation and schemas
- `src/test/` - Comprehensive test suite

## Current State

### Implementation Status

- ✅ **Core Extension**: Fully implemented with DI container
- ✅ **Tree View**: Complete with all CRUD operations
- ✅ **Search System**: Advanced search with webview integration
- ✅ **Copy Functionality**: Recently completed (June 2025)
- ✅ **Configuration**: Advanced config service with runtime updates
- ✅ **Testing**: Comprehensive test coverage
- ✅ **Build System**: Optimized production builds

### Recent Developments

- Advanced dependency injection system implementation
- Search panel with webview integration
- Copy button enhancement with clipboard integration
- Comprehensive event bus for component communication
- Workspace change detection and automatic reinitialization

## Development Environment

- **Platform**: Linux Fedora 41
- **Node.js**: ES Module project with TypeScript
- **VS Code**: Extension development with comprehensive debugging
- **Architecture**: Clean architecture with dependency inversion

## Extension Capabilities

### User Experience

- Activity bar integration with custom icon
- Dual-panel interface (Tree + Search)
- Context menus with relevant actions
- Automatic workspace detection
- Comprehensive error handling and user feedback

### Developer Experience

- Hot reload during development
- Comprehensive logging system
- Type-safe configuration
- Modular and testable architecture
- Clear separation of concerns
