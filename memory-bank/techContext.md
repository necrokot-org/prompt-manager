# Technical Context - Prompt Manager VSCode Extension

## Architecture Overview

The Prompt Manager extension implements a **sophisticated multi-layer architecture** with dependency injection, event-driven communication, and comprehensive separation of concerns.

## Core Technical Stack

### Runtime Environment

- **Platform**: VSCode Extension API v1.96.0+
- **Language**: TypeScript with strict typing and ES modules
- **Module System**: ES Modules (`"type": "module"`)
- **Reflection**: reflect-metadata for DI metadata

### Build & Development

- **Build System**: esbuild with watch mode and production optimization
- **Testing**: VSCode Test Framework with comprehensive coverage
- **Linting**: ESLint with TypeScript rules
- **Type Checking**: Strict TypeScript configuration

## Dependency Injection System

### IoC Container Implementation

- **Location**: `src/infrastructure/di/di-container.ts`
- **Tokens**: `src/infrastructure/di/di-tokens.ts`
- **Pattern**: Constructor injection with metadata reflection
- **Lifecycle**: Singleton services with automatic resolution

### Service Registration

```typescript
// Service registration with DI tokens
configureDependencies(context);
const service = resolve<ServiceType>(DI_TOKENS.ServiceName);
```

### Key Services

- `ConfigurationService` - Configuration management
- `PromptController` - Business logic coordination
- `PromptTreeProvider` - UI tree component
- `SearchPanelProvider` - Search webview component
- `SearchService` - Search engine implementation
- `CommandHandler` - Command orchestration

## Feature Architecture

### Prompt Manager Feature (`src/features/prompt-manager/`)

- **Domain Layer**: `domain/` - Controllers and repositories
- **UI Layer**: `ui/tree/` - Tree providers and components
- **Data Layer**: `data/` - File management and scanning

### Search Feature (`src/features/search/`)

- **Services**: `services/` - Search engine and algorithms
- **UI**: `ui/` - Webview panel integration
- **Utils**: `utils/` - Prompt file utilities

## Infrastructure Layer

### Configuration System (`src/infrastructure/config/`)

- **Features**: Runtime config updates, validation, workspace detection
- **Integration**: VSCode configuration API with custom settings
- **Events**: Configuration change notifications

### File System Abstraction (`src/infrastructure/fs/`)

- **Purpose**: File operations abstraction and error handling
- **Features**: Path resolution, file watching, atomic operations

### VSCode Integration (`src/infrastructure/vscode/`)

- **Event Bus**: `ExtensionBus.ts` - Pub/sub communication
- **Logging**: `log.ts` - Structured logging with output channels

## Event-Driven Architecture

### Event Bus System

- **Implementation**: Custom pub/sub with typed events
- **Usage**: Inter-component communication without tight coupling
- **Events**: Config changes, search criteria updates, workspace changes

### Key Event Patterns

```typescript
eventBus.emit("search.criteria.changed", criteria);
eventBus.on("config.workspace.changed", handler);
```

## Search Engine Implementation

### Technologies

- **Fuse.js**: Fuzzy search with configurable algorithms
- **Lucene Query Parser**: Advanced query syntax support
- **Real-time Filtering**: Instant search with result counting

### Architecture

- **SearchService**: Core search logic and indexing
- **SearchPanelProvider**: Webview integration and UI
- **SearchCriteria**: Type-safe search parameters

## UI Architecture

### Tree View System

- **Provider Pattern**: VSCode TreeDataProvider implementation
- **Item Hierarchy**: Base classes with specialized implementations
- **Factory Pattern**: ItemFactory for tree item creation
- **Context Menus**: Dynamic menu generation based on item types

### Webview Integration

- **Search Panel**: Full webview with HTML/CSS/JS
- **Bidirectional Communication**: Message passing between extension and webview
- **State Management**: Synchronized state with extension backend

## Testing Strategy

### Test Categories

- **Unit Tests**: Service and component testing
- **Integration Tests**: Feature workflow testing
- **Extension Tests**: VSCode API integration testing

### Test Infrastructure

- **Framework**: VSCode Test Framework
- **Helpers**: Custom test utilities and mocks
- **Coverage**: Comprehensive test coverage across layers

## Development Patterns

### Architectural Patterns

- **Dependency Injection**: IoC for loose coupling
- **Repository Pattern**: Data access abstraction
- **Command Pattern**: Command handling and orchestration
- **Observer Pattern**: Event-driven communication
- **Factory Pattern**: Object creation and configuration

### Code Organization

- **Feature Modules**: Business capability organization
- **Layer Separation**: Clear boundaries between UI, domain, infrastructure
- **Type Safety**: Comprehensive TypeScript typing
- **Error Handling**: Structured error handling with user feedback

## Performance Considerations

### Optimization Strategies

- **Lazy Loading**: Service resolution on demand
- **Caching**: LRU cache for search results and file operations
- **Debouncing**: Search input debouncing for performance
- **Background Operations**: Non-blocking file system operations

### Build Optimization

- **Tree Shaking**: Dead code elimination
- **Bundle Splitting**: Optimized extension bundle
- **Production Mode**: Minification and optimization flags

## Extension Lifecycle

### Activation

1. **DI Container Setup**: Service registration and configuration
2. **Service Resolution**: Lazy singleton creation
3. **Component Initialization**: UI and business logic setup
4. **Event Registration**: Command and event handler setup
5. **Workspace Detection**: Automatic initialization on workspace change

### Deactivation

- **Cleanup**: Resource disposal and event unsubscription
- **DI Container**: Service disposal and cleanup
- **State Persistence**: Configuration and cache cleanup
