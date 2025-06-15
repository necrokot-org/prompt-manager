// Event System for Prompt Manager Extension
import * as vscode from "vscode";

// Base event interface
export interface BaseEvent {
  type: string;
  timestamp: number;
  source?: string;
}

// Event payload interfaces organized by category
export namespace FileSystemEvents {
  export interface FileCreated extends BaseEvent {
    type: "filesystem.file.created";
    payload: {
      filePath: string;
      fileName: string;
    };
  }

  export interface FileDeleted extends BaseEvent {
    type: "filesystem.file.deleted";
    payload: {
      filePath: string;
      fileName: string;
    };
  }

  export interface FileChanged extends BaseEvent {
    type: "filesystem.file.changed";
    payload: {
      filePath: string;
      fileName: string;
    };
  }

  export interface DirectoryCreated extends BaseEvent {
    type: "filesystem.directory.created";
    payload: {
      dirPath: string;
      dirName: string;
    };
  }

  export interface StructureChanged extends BaseEvent {
    type: "filesystem.structure.changed";
    payload: {
      reason:
        | "file-created"
        | "file-deleted"
        | "file-changed"
        | "directory-created"
        | "manual-refresh";
      affectedPath?: string;
    };
  }
}

export namespace SearchEvents {
  export interface SearchCriteriaChanged extends BaseEvent {
    type: "search.criteria.changed";
    payload: {
      query: string;
      scope: "titles" | "content" | "both";
      caseSensitive: boolean;
      isActive: boolean;
    };
  }

  export interface SearchResultsUpdated extends BaseEvent {
    type: "search.results.updated";
    payload: {
      resultCount: number;
      query: string;
    };
  }

  export interface SearchCleared extends BaseEvent {
    type: "search.cleared";
    payload: {};
  }
}

export namespace UIEvents {
  export interface TreeRefreshRequested extends BaseEvent {
    type: "ui.tree.refresh.requested";
    payload: {
      reason: "manual" | "file-change" | "search-change";
    };
  }

  export interface TreeItemSelected extends BaseEvent {
    type: "ui.tree.item.selected";
    payload: {
      itemType: "file" | "folder";
      itemPath: string;
      itemName: string;
    };
  }

  export interface PromptOpened extends BaseEvent {
    type: "ui.prompt.opened";
    payload: {
      filePath: string;
      fileName: string;
    };
  }

  export interface PromptCreated extends BaseEvent {
    type: "ui.prompt.created";
    payload: {
      filePath: string;
      fileName: string;
      folderPath?: string;
    };
  }
}

export namespace ConfigurationEvents {
  export interface ConfigChanged extends BaseEvent {
    type: "config.changed";
    payload: {
      configKey: string;
      oldValue?: any;
      newValue: any;
    };
  }

  export interface WorkspaceChanged extends BaseEvent {
    type: "config.workspace.changed";
    payload: {
      workspaceFolders: readonly vscode.WorkspaceFolder[];
      reason:
        | "folder-added"
        | "folder-removed"
        | "workspace-opened"
        | "workspace-closed";
    };
  }
}

// Union type of all possible events
export type ExtensionEvent =
  | FileSystemEvents.FileCreated
  | FileSystemEvents.FileDeleted
  | FileSystemEvents.FileChanged
  | FileSystemEvents.DirectoryCreated
  | FileSystemEvents.StructureChanged
  | SearchEvents.SearchCriteriaChanged
  | SearchEvents.SearchResultsUpdated
  | SearchEvents.SearchCleared
  | UIEvents.TreeRefreshRequested
  | UIEvents.TreeItemSelected
  | UIEvents.PromptOpened
  | UIEvents.PromptCreated
  | ConfigurationEvents.ConfigChanged
  | ConfigurationEvents.WorkspaceChanged;

// Event handler type
export type EventHandler<T extends ExtensionEvent = ExtensionEvent> = (
  event: T
) => void | Promise<void>;

// Event middleware interface
export interface EventMiddleware {
  name: string;
  process<T extends ExtensionEvent>(
    event: T,
    next: (event: T) => void
  ): void | Promise<void>;
}

// Event subscription interface
export interface EventSubscription {
  unsubscribe(): void;
}

// Logging middleware
export class LoggingMiddleware implements EventMiddleware {
  name = "logging";

  process<T extends ExtensionEvent>(event: T, next: (event: T) => void): void {
    console.log(`[EventBus] ${event.type}:`, {
      timestamp: new Date(event.timestamp).toISOString(),
      source: event.source,
      payload: event.payload,
    });
    next(event);
  }
}

// Filtering middleware
export class FilteringMiddleware implements EventMiddleware {
  name = "filtering";

  constructor(private filter: (event: ExtensionEvent) => boolean) {}

  process<T extends ExtensionEvent>(event: T, next: (event: T) => void): void {
    if (this.filter(event)) {
      next(event);
    }
  }
}

// Performance monitoring middleware
export class PerformanceMiddleware implements EventMiddleware {
  name = "performance";
  private eventTimes = new Map<string, number>();

  process<T extends ExtensionEvent>(event: T, next: (event: T) => void): void {
    const startTime = performance.now();
    const eventKey = `${event.type}-${event.timestamp}`;

    next(event);

    const endTime = performance.now();
    const duration = endTime - startTime;
    this.eventTimes.set(eventKey, duration);

    // Log slow events
    if (duration > 100) {
      console.warn(
        `[EventBus] Slow event processing: ${
          event.type
        } took ${duration.toFixed(2)}ms`
      );
    }
  }

  getStats(): {
    averageTime: number;
    slowEvents: Array<{ type: string; duration: number }>;
  } {
    const times = Array.from(this.eventTimes.values());
    const averageTime =
      times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;

    const slowEvents = Array.from(this.eventTimes.entries())
      .filter(([_, duration]) => duration > 50)
      .map(([key, duration]) => ({
        type: key.split("-")[0],
        duration,
      }));

    return { averageTime, slowEvents };
  }
}

// Central Event Bus
export class ExtensionEventBus {
  private handlers = new Map<string, Set<EventHandler>>();
  private middleware: EventMiddleware[] = [];
  private isDisposed = false;

  constructor() {
    // Add default middleware
    this.addMiddleware(new LoggingMiddleware());
    this.addMiddleware(new PerformanceMiddleware());
  }

  /**
   * Add middleware to the event processing pipeline
   */
  addMiddleware(middleware: EventMiddleware): void {
    this.middleware.push(middleware);
  }

  /**
   * Remove middleware by name
   */
  removeMiddleware(name: string): boolean {
    const index = this.middleware.findIndex((m) => m.name === name);
    if (index !== -1) {
      this.middleware.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Subscribe to a specific event type
   */
  subscribe<T extends ExtensionEvent>(
    eventType: T["type"],
    handler: EventHandler<T>
  ): EventSubscription {
    if (this.isDisposed) {
      throw new Error("EventBus has been disposed");
    }

    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }

    const handlers = this.handlers.get(eventType)!;
    handlers.add(handler as EventHandler);

    return {
      unsubscribe: () => {
        handlers.delete(handler as EventHandler);
        if (handlers.size === 0) {
          this.handlers.delete(eventType);
        }
      },
    };
  }

  /**
   * Subscribe to multiple event types with the same handler
   */
  subscribeToMultiple<T extends ExtensionEvent>(
    eventTypes: T["type"][],
    handler: EventHandler<T>
  ): EventSubscription {
    const subscriptions = eventTypes.map((type) =>
      this.subscribe(type, handler)
    );

    return {
      unsubscribe: () => {
        subscriptions.forEach((sub) => sub.unsubscribe());
      },
    };
  }

  /**
   * Publish an event to all subscribers
   */
  async publish<T extends ExtensionEvent>(
    event: Omit<T, "timestamp">
  ): Promise<void> {
    if (this.isDisposed) {
      return;
    }

    const fullEvent = {
      ...event,
      timestamp: Date.now(),
    } as T;

    // Process through middleware pipeline
    await this.processEventThroughMiddleware(fullEvent, (processedEvent) => {
      this.notifyHandlers(processedEvent);
    });
  }

  /**
   * Publish event synchronously (for cases where async is not suitable)
   */
  publishSync<T extends ExtensionEvent>(event: Omit<T, "timestamp">): void {
    if (this.isDisposed) {
      return;
    }

    const fullEvent = {
      ...event,
      timestamp: Date.now(),
    } as T;

    // Process through middleware pipeline synchronously
    this.processEventThroughMiddlewareSync(fullEvent, (processedEvent) => {
      this.notifyHandlers(processedEvent);
    });
  }

  /**
   * Get statistics about event handling
   */
  getStats(): {
    subscriberCount: number;
    eventTypes: string[];
    middlewareCount: number;
    performanceStats?: any;
  } {
    const performanceMiddleware = this.middleware.find(
      (m) => m instanceof PerformanceMiddleware
    ) as PerformanceMiddleware;

    return {
      subscriberCount: Array.from(this.handlers.values()).reduce(
        (sum, set) => sum + set.size,
        0
      ),
      eventTypes: Array.from(this.handlers.keys()),
      middlewareCount: this.middleware.length,
      performanceStats: performanceMiddleware?.getStats(),
    };
  }

  /**
   * Clear all event handlers (useful for testing)
   */
  clear(): void {
    this.handlers.clear();
  }

  /**
   * Dispose of the event bus
   */
  dispose(): void {
    this.clear();
    this.middleware.length = 0;
    this.isDisposed = true;
  }

  // Private methods

  private async processEventThroughMiddleware<T extends ExtensionEvent>(
    event: T,
    finalHandler: (event: T) => void
  ): Promise<void> {
    let currentIndex = 0;

    const next = (processedEvent: T) => {
      if (currentIndex >= this.middleware.length) {
        finalHandler(processedEvent);
        return;
      }

      const middleware = this.middleware[currentIndex++];
      middleware.process(processedEvent, next);
    };

    next(event);
  }

  private processEventThroughMiddlewareSync<T extends ExtensionEvent>(
    event: T,
    finalHandler: (event: T) => void
  ): void {
    let currentIndex = 0;

    const next = (processedEvent: T) => {
      if (currentIndex >= this.middleware.length) {
        finalHandler(processedEvent);
        return;
      }

      const middleware = this.middleware[currentIndex++];
      const result = middleware.process(processedEvent, next);

      // If middleware returns a promise, we can't handle it in sync mode
      if (result instanceof Promise) {
        console.warn(
          `[EventBus] Middleware ${middleware.name} returned a promise in sync mode`
        );
      }
    };

    next(event);
  }

  private notifyHandlers<T extends ExtensionEvent>(event: T): void {
    const handlers = this.handlers.get(event.type);
    if (!handlers) {
      return;
    }

    // Notify all handlers, catching and logging any errors
    for (const handler of handlers) {
      try {
        const result = handler(event);
        if (result instanceof Promise) {
          result.catch((error) => {
            console.error(`[EventBus] Handler error for ${event.type}:`, error);
          });
        }
      } catch (error) {
        console.error(`[EventBus] Handler error for ${event.type}:`, error);
      }
    }
  }
}

// Event builder utilities
export class EventBuilder {
  static fileSystem = {
    fileCreated: (
      filePath: string,
      source?: string
    ): Omit<FileSystemEvents.FileCreated, "timestamp"> => ({
      type: "filesystem.file.created",
      source,
      payload: {
        filePath,
        fileName: filePath.split(/[/\\]/).pop() || filePath,
      },
    }),

    fileDeleted: (
      filePath: string,
      source?: string
    ): Omit<FileSystemEvents.FileDeleted, "timestamp"> => ({
      type: "filesystem.file.deleted",
      source,
      payload: {
        filePath,
        fileName: filePath.split(/[/\\]/).pop() || filePath,
      },
    }),

    fileChanged: (
      filePath: string,
      source?: string
    ): Omit<FileSystemEvents.FileChanged, "timestamp"> => ({
      type: "filesystem.file.changed",
      source,
      payload: {
        filePath,
        fileName: filePath.split(/[/\\]/).pop() || filePath,
      },
    }),

    directoryCreated: (
      dirPath: string,
      source?: string
    ): Omit<FileSystemEvents.DirectoryCreated, "timestamp"> => ({
      type: "filesystem.directory.created",
      source,
      payload: {
        dirPath,
        dirName: dirPath.split(/[/\\]/).pop() || dirPath,
      },
    }),

    structureChanged: (
      reason: FileSystemEvents.StructureChanged["payload"]["reason"],
      affectedPath?: string,
      source?: string
    ): Omit<FileSystemEvents.StructureChanged, "timestamp"> => ({
      type: "filesystem.structure.changed",
      source,
      payload: {
        reason,
        affectedPath,
      },
    }),
  };

  static search = {
    criteriaChanged: (
      query: string,
      scope: "titles" | "content" | "both",
      caseSensitive: boolean,
      isActive: boolean,
      source?: string
    ): Omit<SearchEvents.SearchCriteriaChanged, "timestamp"> => ({
      type: "search.criteria.changed",
      source,
      payload: {
        query,
        scope,
        caseSensitive,
        isActive,
      },
    }),

    resultsUpdated: (
      resultCount: number,
      query: string,
      source?: string
    ): Omit<SearchEvents.SearchResultsUpdated, "timestamp"> => ({
      type: "search.results.updated",
      source,
      payload: {
        resultCount,
        query,
      },
    }),

    cleared: (
      source?: string
    ): Omit<SearchEvents.SearchCleared, "timestamp"> => ({
      type: "search.cleared",
      source,
      payload: {},
    }),
  };

  static ui = {
    treeRefreshRequested: (
      reason: UIEvents.TreeRefreshRequested["payload"]["reason"],
      source?: string
    ): Omit<UIEvents.TreeRefreshRequested, "timestamp"> => ({
      type: "ui.tree.refresh.requested",
      source,
      payload: {
        reason,
      },
    }),

    promptOpened: (
      filePath: string,
      source?: string
    ): Omit<UIEvents.PromptOpened, "timestamp"> => ({
      type: "ui.prompt.opened",
      source,
      payload: {
        filePath,
        fileName: filePath.split(/[/\\]/).pop() || filePath,
      },
    }),

    promptCreated: (
      filePath: string,
      folderPath?: string,
      source?: string
    ): Omit<UIEvents.PromptCreated, "timestamp"> => ({
      type: "ui.prompt.created",
      source,
      payload: {
        filePath,
        fileName: filePath.split(/[/\\]/).pop() || filePath,
        folderPath,
      },
    }),
  };

  static config = {
    configChanged: (
      configKey: string,
      newValue: any,
      oldValue?: any,
      source?: string
    ): Omit<ConfigurationEvents.ConfigChanged, "timestamp"> => ({
      type: "config.changed",
      source,
      payload: {
        configKey,
        oldValue,
        newValue,
      },
    }),

    workspaceChanged: (
      workspaceFolders: readonly vscode.WorkspaceFolder[],
      reason: ConfigurationEvents.WorkspaceChanged["payload"]["reason"],
      source?: string
    ): Omit<ConfigurationEvents.WorkspaceChanged, "timestamp"> => ({
      type: "config.workspace.changed",
      source,
      payload: {
        workspaceFolders,
        reason,
      },
    }),
  };
}
