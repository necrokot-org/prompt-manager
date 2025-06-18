# System Patterns - Prompt Manager VSCode Extension

## Architectural Patterns

### 1. Dependency Injection (IoC Container)

**Pattern**: Constructor injection with metadata reflection  
**Implementation**: Custom DI container with service tokens  
**Benefits**: Loose coupling, testability, service lifetime management

```typescript
// Service Definition
@injectable()
class PromptController {
  constructor(
    @inject(DI_TOKENS.PromptRepository) private repository: PromptRepository
  ) {}
}

// Registration & Resolution
configureDependencies(context);
const controller = resolve<PromptController>(DI_TOKENS.PromptController);
```

### 2. Feature-Based Organization

**Pattern**: Modular organization by business capabilities  
**Structure**: Each feature contains domain, UI, and data layers  
**Benefits**: Maintainability, clear boundaries, team collaboration

```
src/features/
  prompt-manager/
    domain/     # Business logic
    ui/         # Presentation layer
    data/       # Data access
  search/
    services/   # Search algorithms
    ui/         # Search interface
```

### 3. Event-Driven Architecture

**Pattern**: Pub/sub communication via event bus  
**Implementation**: Custom typed event system  
**Benefits**: Decoupling, extensibility, reactive updates

```typescript
// Event Publishing
eventBus.emit("search.criteria.changed", {
  query: "test",
  scope: "all",
  isActive: true,
});

// Event Subscription
eventBus.on("search.criteria.changed", async (payload) => {
  const count = await searchService.countMatches(payload);
  searchProvider.updateResultCount(count);
});
```

### 4. Repository Pattern

**Pattern**: Data access abstraction  
**Implementation**: Interface-based repositories with file system integration  
**Benefits**: Testability, data source flexibility, separation of concerns

```typescript
interface PromptRepository {
  findAll(): Promise<PromptFile[]>;
  findByPath(path: string): Promise<PromptFile | null>;
  save(prompt: PromptFile): Promise<void>;
  delete(path: string): Promise<void>;
}
```

### 5. Command Pattern

**Pattern**: Encapsulated command handling  
**Implementation**: Centralized command handler with typed commands  
**Benefits**: Consistency, middleware support, audit trail

```typescript
class CommandHandler {
  registerCommands(): void {
    this.registerCommand("promptManager.addPrompt", this.handleAddPrompt);
    this.registerCommand("promptManager.deletePrompt", this.handleDeletePrompt);
  }
}
```

## Design Patterns

### 1. Factory Pattern

**Usage**: Tree item creation and configuration  
**Implementation**: ItemFactory with type-based creation  
**Benefits**: Consistent object creation, extensibility

```typescript
class ItemFactory {
  createTreeItem(item: FileSystemItem): BaseTreeItem {
    if (item.type === "file") return new FileTreeItem(item);
    if (item.type === "folder") return new FolderTreeItem(item);
    return new EmptyStateTreeItem();
  }
}
```

### 2. Observer Pattern

**Usage**: Configuration changes, search updates  
**Implementation**: Event bus with typed subscribers  
**Benefits**: Reactive updates, loose coupling

### 3. Strategy Pattern

**Usage**: Search algorithms, file naming patterns  
**Implementation**: Configurable search and naming strategies  
**Benefits**: Algorithm flexibility, runtime configuration

### 4. Provider Pattern

**Usage**: VSCode tree and webview providers  
**Implementation**: VSCode provider interface implementations  
**Benefits**: VSCode integration, standardized interfaces

## Coding Conventions

### 1. TypeScript Patterns

- **Strict Typing**: All functions and classes fully typed
- **Interface Segregation**: Small, focused interfaces
- **Generic Types**: Reusable type-safe components
- **Utility Types**: Leveraging TypeScript utility types

### 2. Naming Conventions

- **Classes**: PascalCase (e.g., `PromptController`)
- **Functions**: camelCase (e.g., `findAllPrompts`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `DI_TOKENS`)
- **Files**: kebab-case (e.g., `prompt-controller.ts`)

### 3. Error Handling Patterns

- **Structured Errors**: Custom error types with context
- **Logging Integration**: Comprehensive error logging
- **User Feedback**: User-friendly error messages
- **Graceful Degradation**: Fallback behaviors for failures

```typescript
try {
  await promptController.initialize();
} catch (error) {
  log.error("Failed to initialize prompt controller:", error);
  vscode.window.showErrorMessage(`Failed to initialize: ${error}`);
}
```

### 4. Configuration Patterns

- **Type-Safe Config**: Configuration schemas with validation
- **Runtime Updates**: Dynamic configuration changes
- **Default Values**: Sensible defaults with override capability
- **Environment Awareness**: Development vs production settings

## Testing Patterns

### 1. Test Organization

- **Test Location**: Co-located with source files (`*.test.ts`)
- **Test Categories**: Unit, integration, end-to-end
- **Test Naming**: Descriptive test names with behavior descriptions

### 2. Mocking Patterns

- **Dependency Mocking**: Injectable mock implementations
- **VSCode API Mocking**: Mock VSCode APIs for testing
- **File System Mocking**: Mock file operations for isolated tests

### 3. Test Data Patterns

- **Test Helpers**: Reusable test utilities and factories
- **Fixture Data**: Consistent test data sets
- **Cleanup Patterns**: Automatic test cleanup and isolation

## File Organization Patterns

### 1. Directory Structure

- **Feature Modules**: Business capability organization
- **Layer Separation**: Clear separation of concerns
- **Shared Resources**: Common utilities and types
- **Test Co-location**: Tests near implementation

### 2. Import Patterns

- **Path Aliases**: TypeScript path mapping for clean imports
- **Barrel Exports**: Index files for clean module exports
- **Dependency Direction**: Inward dependencies only

```typescript
// Path Aliases
import { PromptController } from "@features/prompt-manager/domain/promptController";
import { log } from "@infra/vscode/log";

// Barrel Exports
export * from "./BaseTreeItem";
export * from "./FileTreeItem";
export * from "./FolderTreeItem";
```

### 3. Configuration Files

- **TypeScript Config**: Strict type checking with path mapping
- **ESLint Config**: Consistent code style enforcement
- **Build Config**: Optimized build for development and production

## Communication Patterns

### 1. Inter-Component Communication

- **Event Bus**: Pub/sub for loose coupling
- **Dependency Injection**: Service composition
- **Interface Contracts**: Well-defined service interfaces

### 2. VSCode Integration

- **Command Registration**: Centralized command handling
- **Configuration Integration**: VSCode settings integration
- **UI Integration**: Tree view and webview providers

### 3. Error Communication

- **Logging System**: Structured logging with levels
- **User Notifications**: Appropriate user feedback
- **Error Propagation**: Consistent error handling chains

## Performance Patterns

### 1. Caching Strategies

- **LRU Cache**: Least recently used cache for search results
- **File System Cache**: Cached file scanning results
- **Configuration Cache**: Cached configuration values

### 2. Lazy Loading

- **Service Resolution**: Services created on first use
- **Tree Item Loading**: Tree items loaded on expansion
- **Search Indexing**: Search index built incrementally

### 3. Debouncing

- **Search Input**: Debounced search queries
- **File Watching**: Debounced file system events
- **Configuration Updates**: Debounced config change handling
