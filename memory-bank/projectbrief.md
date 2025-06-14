# Prompt Manager - VS Code Extension Project Brief

## Project Overview

A VSCode extension designed to manage prompts for LLMs with tree view organization and file management capabilities.

## Core Features

- Tree view integration in VS Code Explorer
- Prompt file management (add, open, delete)
- Folder organization system
- File system operations for prompt storage

## Technical Stack

- **Platform:** VS Code Extension API (v1.96.0+)
- **Language:** TypeScript
- **Build System:** esbuild + npm scripts
- **Linting:** ESLint with TypeScript support
- **Testing:** VS Code Test Framework

## Project Structure

- `src/extension.ts` - Main extension entry point
- `src/promptManager.ts` - Core prompt management logic
- `src/promptTreeProvider.ts` - Tree view provider implementation
- `src/fileManager.ts` - File system operations
- `src/commandHandler.ts` - Command handling logic

## Current State

- Basic extension structure established
- Tree view and commands configured in package.json
- Core TypeScript modules implemented
- Build system configured and operational

## Development Environment

- Platform: Linux Fedora 41
- Node.js project with TypeScript
- VS Code extension development environment
