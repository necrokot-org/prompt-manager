# Centralized Event System Documentation

## Overview

The Prompt Manager extension now uses a centralized event system to replace scattered event handling patterns. This system provides type-safe, decoupled communication between components through a single event bus.

## Architecture

### Core Components

1. **ExtensionEventBus** - Central event dispatcher
2. **Event Types** - Typed event interfaces organized by category
3. **Event Middleware** - Pluggable event processing pipeline
4. **Event Builders** - Utility functions for creating events

### Event Categories

Events are organized into namespaced categories:

- **FileSystem Events** (`filesystem.*`) - File operations, directory changes
- **Search Events** (`search.*`) - Search criteria, results
- **UI Events** (`ui.*`) - User interface interactions
- **Configuration Events** (`config.*`) - Settings and workspace changes

## Event Types

### FileSystem Events

```typescript
// File operations
"filesystem.file.created"; // New file created
"filesystem.file.deleted"; // File deleted
"filesystem.file.changed"; // File content changed
"filesystem.directory.created"; // New directory created
"filesystem.structure.changed"; // Overall structure changed
```

### Search Events

```typescript
// Search operations
"search.criteria.changed"; // Search parameters updated
"search.results.updated"; // Search results count updated
"search.cleared"; // Search cleared/reset
```

### UI Events

```typescript
// User interface
"ui.tree.refresh.requested"; // Tree view refresh needed
"ui.tree.item.selected"; // Tree item selected
"ui.prompt.opened"; // Prompt file opened
"ui.prompt.created"; // New prompt created
```

### Configuration Events

```typescript
// Configuration changes
"config.changed"; // Setting value changed
"config.workspace.changed"; // Workspace folders changed
```

## Usage Patterns

### Publishing Events

```typescript
// Using EventBuilder (recommended)
eventBus.publishSync(
  EventBuilder.fileSystem.fileCreated(filePath, "MyComponent")
);

// Direct event creation
eventBus.publish({
  type: "filesystem.file.created",
  source: "MyComponent",
  payload: {
    filePath: "/path/to/file.md",
    fileName: "file.md",
  },
});
```

### Subscribing to Events

```typescript
// Subscribe to specific event type
const subscription = eventBus.subscribe("filesystem.file.created", (event) => {
  console.log(`File created: ${event.payload.filePath}`);
});

// Subscribe to multiple event types
const multiSubscription = eventBus.subscribeToMultiple(
  ["filesystem.file.created", "filesystem.file.deleted"],
  (event) => {
    console.log(`File system event: ${event.type}`);
  }
);

// Cleanup subscriptions
subscription.unsubscribe();
multiSubscription.unsubscribe();
```

### Type-Safe Event Handling

```typescript
import { SearchEvents } from "./core/EventSystem";

eventBus.subscribe("search.criteria.changed", (event) => {
  // Cast to specific event type for type safety
  const searchEvent = event as SearchEvents.SearchCriteriaChanged;
  const { query, scope, caseSensitive, isActive } = searchEvent.payload;

  // TypeScript now knows the exact shape of the payload
});
```

## Middleware System

### Built-in Middleware

1. **LoggingMiddleware** - Logs all events with timestamps
2. **PerformanceMiddleware** - Monitors event processing performance
3. **FilteringMiddleware** - Filters events based on criteria

### Adding Custom Middleware

```typescript
class ValidationMiddleware implements EventMiddleware {
  name = "validation";

  process<T extends ExtensionEvent>(event: T, next: (event: T) => void): void {
    // Validate event payload
    if (this.isValidEvent(event)) {
      next(event);
    } else {
      console.warn(`Invalid event: ${event.type}`);
    }
  }

  private isValidEvent(event: ExtensionEvent): boolean {
    // Custom validation logic
    return event.payload !== null;
  }
}

// Add to event bus
eventBus.addMiddleware(new ValidationMiddleware());
```

## Component Integration

### Before (Old Pattern)

```typescript
// Scattered EventEmitters
class PromptRepository {
  private _onStructureChanged = new vscode.EventEmitter<void>();
  public readonly onStructureChanged = this._onStructureChanged.event;

  private handleFileChange() {
    this._onStructureChanged.fire();
  }
}

class PromptController {
  constructor(repository: PromptRepository) {
    repository.onStructureChanged(() => {
      this.refresh();
    });
  }
}
```

### After (Event Bus Pattern)

```typescript
// Centralized event system
class PromptRepository {
  constructor(private eventBus: ExtensionEventBus) {}

  private handleFileChange(filePath: string) {
    this.eventBus.publishSync(
      EventBuilder.fileSystem.structureChanged(
        "file-changed",
        filePath,
        "PromptRepository"
      )
    );
  }
}

class PromptController {
  constructor(private eventBus: ExtensionEventBus) {
    this.eventBus.subscribe("filesystem.structure.changed", () => {
      this.publishTreeRefreshEvent("file-change");
    });
  }
}
```

## Migration Status - COMPLETED ✅

All components have been successfully migrated to the centralized event system:

### ✅ Migrated Components

| Component                | Status      | Key Changes                                          |
| ------------------------ | ----------- | ---------------------------------------------------- |
| **ExtensionEventBus**    | ✅ Complete | Core event system with middleware pipeline           |
| **ConfigurationService** | ✅ Complete | Publishes config change events                       |
| **PromptRepository**     | ✅ Complete | Publishes filesystem structure change events         |
| **PromptController**     | ✅ Complete | Subscribes to structure changes, publishes UI events |
| **PromptTreeProvider**   | ✅ Complete | Subscribes to tree refresh and search events         |
| **SearchPanelProvider**  | ✅ Complete | Publishes search criteria and cleared events         |
| **CommandHandler**       | ✅ Complete | Publishes UI events for user actions                 |
| **FileManager**          | ✅ Complete | Publishes filesystem events (create/delete)          |
| **SearchService**        | ✅ Complete | Publishes search result events                       |
| **Extension Main**       | ✅ Complete | Initializes event bus and passes to all components   |

### ✅ Test Updates

| Test File                       | Status      | Key Changes                                       |
| ------------------------------- | ----------- | ------------------------------------------------- |
| **searchPanelProvider.test.ts** | ✅ Complete | Uses mock event bus instead of old event patterns |
| **integration.test.ts**         | ✅ Complete | Tests event bus communication between components  |
| **helpers.ts**                  | ✅ Complete | Added temp directory utilities for testing        |

### ✅ Event Flow Verification

The following event flows are now properly implemented:

1. **File Operations** → FileManager publishes events → PromptRepository/PromptController react
2. **Configuration Changes** → ConfigurationService publishes events → Components react
3. **Search Actions** → SearchPanelProvider publishes events → TreeProvider filters results
4. **User Commands** → CommandHandler publishes events → UI components update
5. **Tree Refresh** → Controller publishes events → TreeProvider refreshes display

### ✅ Event Bus Statistics

The event bus now provides monitoring capabilities:

- Subscriber count tracking
- Event type registration
- Middleware performance metrics
- Built-in logging and debugging support

### ✅ Cleanup and Disposal

All components properly:

- Unsubscribe from events in dispose methods
- Clean up resources in reverse initialization order
- Maintain proper lifecycle management

## Benefits Achieved

### 1. Decoupled Communication

Components no longer need direct references to each other. They communicate through events, making the system more modular.

### 2. Type Safety

All events are strongly typed with TypeScript interfaces, preventing runtime errors from malformed event data.

### 3. Centralized Logging

All events flow through the event bus, providing a single place to log, monitor, and debug component interactions.

### 4. Easier Testing

Components can be tested in isolation by mocking the event bus or subscribing to events to verify behavior.

### 5. Cross-Cutting Concerns

Middleware allows adding features like analytics, performance monitoring, or debugging without modifying individual components.

### 6. Event Replay

Events can be recorded and replayed for debugging or testing purposes.

## Best Practices

### 1. Use EventBuilder

Always use `EventBuilder` utility functions instead of creating events manually:

```typescript
// ✅ Good
eventBus.publishSync(EventBuilder.ui.promptOpened(filePath, "MyComponent"));

// ❌ Avoid
eventBus.publishSync({
  type: "ui.prompt.opened",
  source: "MyComponent",
  payload: { filePath, fileName: path.basename(filePath) },
});
```

### 2. Include Source Information

Always specify the source component when publishing events for better debugging:

```typescript
eventBus.publishSync(
  EventBuilder.fileSystem.fileCreated(filePath, "FileManager")
);
```

### 3. Handle Async Operations Properly

Use `publish()` for async operations and `publishSync()` for synchronous ones:

```typescript
// ✅ Async operation
await eventBus.publish(EventBuilder.search.resultsUpdated(count, query));

// ✅ Sync operation
eventBus.publishSync(EventBuilder.ui.treeRefreshRequested("manual"));
```

### 4. Clean Up Subscriptions

Always unsubscribe from events in component dispose methods:

```typescript
class MyComponent {
  private subscriptions: EventSubscription[] = [];

  constructor(eventBus: ExtensionEventBus) {
    this.subscriptions.push(
      eventBus.subscribe("filesystem.file.created", this.handleFileCreated)
    );
  }

  dispose() {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.subscriptions = [];
  }
}
```

### 5. Use Typed Event Casting

When you need specific event types, cast them properly:

```typescript
eventBus.subscribe("search.criteria.changed", (event) => {
  const searchEvent = event as SearchEvents.SearchCriteriaChanged;
  // Now you have full type safety on searchEvent.payload
});
```

## Migration Guide

### Step 1: Update Component Constructors

Add `ExtensionEventBus` parameter to component constructors:

```typescript
// Before
constructor(repository: PromptRepository) {}

// After
constructor(eventBus: ExtensionEventBus, repository?: PromptRepository) {
  this.eventBus = eventBus;
  this.repository = repository || new PromptRepository(eventBus);
}
```

### Step 2: Replace EventEmitters

Remove VSCode EventEmitters and use event bus instead:

```typescript
// Before
private _onDataChanged = new vscode.EventEmitter<void>();
public readonly onDataChanged = this._onDataChanged.event;

// After - publish events instead
private notifyDataChanged() {
  this.eventBus.publishSync(
    EventBuilder.ui.treeRefreshRequested("data-change", "MyComponent")
  );
}
```

### Step 3: Update Event Subscriptions

Replace direct event listeners with event bus subscriptions:

```typescript
// Before
component.onDataChanged(() => this.refresh());

// After
this.subscriptions.push(
  this.eventBus.subscribe("ui.tree.refresh.requested", () => this.refresh())
);
```

### Step 4: Add Disposal Logic

Ensure components properly clean up event subscriptions:

```typescript
dispose() {
  this.subscriptions.forEach(sub => sub.unsubscribe());
  this.subscriptions = [];
}
```

## Debugging and Monitoring

### Event Bus Statistics

Get insights into event bus usage:

```typescript
const stats = eventBus.getStats();
console.log(`Subscribers: ${stats.subscriberCount}`);
console.log(`Event types: ${stats.eventTypes.join(", ")}`);
console.log(`Middleware: ${stats.middlewareCount}`);
```

### Performance Monitoring

The PerformanceMiddleware automatically tracks slow events:

```typescript
const perfMiddleware = eventBus.getMiddleware(
  "performance"
) as PerformanceMiddleware;
const perfStats = perfMiddleware.getStats();
console.log(`Average event processing time: ${perfStats.averageTime}ms`);
```

### Custom Logging

Add custom middleware for specific logging needs:

```typescript
class DebugMiddleware implements EventMiddleware {
  name = "debug";

  process<T extends ExtensionEvent>(event: T, next: (event: T) => void): void {
    if (event.type.startsWith("filesystem.")) {
      console.log(`[DEBUG] FileSystem event: ${event.type}`, event.payload);
    }
    next(event);
  }
}
```

## Future Enhancements

1. **Event Persistence** - Save events to disk for replay across sessions
2. **Event Visualization** - VSCode command to show event flow diagram
3. **Performance Profiling** - Detailed performance metrics per event type
4. **Event Filtering** - User-configurable event filters for debugging
5. **Remote Event Monitoring** - Send events to external monitoring tools
