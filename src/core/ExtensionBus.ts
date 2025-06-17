import * as vscode from "vscode";
import type { ExtensionEvent } from "./EventSystem";

/**
 * VS Code EventEmitter-based extension bus
 * Replaces RxJS-based eventBus.ts with native VS Code infrastructure
 *
 * Benefits:
 * - Zero dependencies (removes ~18KB RxJS)
 * - Native VS Code disposal integration
 * - Faster cold-start performance
 * - Synchronous event dispatch (matches current RxJS Subject behavior)
 */

/**
 * Subscription handle that matches the existing eventBus API
 */
export interface ExtensionSubscription {
  unsubscribe(): void;
}

/**
 * Internal subscription management
 */
interface ManagedSubscription {
  types: string[];
  handler: (event: ExtensionEvent) => void;
  disposable: vscode.Disposable;
}

/**
 * Singleton event bus using VS Code's EventEmitter
 */
class ExtensionBus {
  private readonly _eventEmitter = new vscode.EventEmitter<ExtensionEvent>();
  private readonly _subscriptions = new Set<ManagedSubscription>();

  /**
   * Event emitter for external access (if needed)
   */
  public readonly onEvent = this._eventEmitter.event;

  /**
   * Publish an event (compatible with existing publish() signature)
   */
  public publish<E extends ExtensionEvent>(event: Omit<E, "timestamp">): void {
    const eventWithTimestamp = { ...event, timestamp: Date.now() } as E;
    this._eventEmitter.fire(eventWithTimestamp);
  }

  /**
   * Subscribe to events (compatible with existing subscribe() signature)
   */
  public subscribe<E extends ExtensionEvent>(
    eventTypes: E["type"] | E["type"][],
    handler: (event: E) => void
  ): ExtensionSubscription {
    const types = Array.isArray(eventTypes) ? eventTypes : [eventTypes];

    // Create filtered handler
    const filteredHandler = (event: ExtensionEvent): void => {
      if (types.includes(event.type as E["type"])) {
        handler(event as E);
      }
    };

    // Subscribe to the event emitter
    const disposable = this.onEvent(filteredHandler);

    // Track the subscription for cleanup
    const managedSub: ManagedSubscription = {
      types,
      handler: filteredHandler,
      disposable,
    };

    this._subscriptions.add(managedSub);

    // Return API-compatible subscription handle
    return {
      unsubscribe: () => {
        disposable.dispose();
        this._subscriptions.delete(managedSub);
      },
    };
  }

  /**
   * Get current subscription count (for diagnostics)
   */
  public getSubscriptionCount(): number {
    return this._subscriptions.size;
  }

  /**
   * Dispose all subscriptions and clean up
   */
  public dispose(): void {
    // Dispose all subscriptions
    for (const sub of this._subscriptions) {
      sub.disposable.dispose();
    }
    this._subscriptions.clear();

    // Dispose the event emitter
    this._eventEmitter.dispose();
  }
}

// Singleton instance
const extensionBus = new ExtensionBus();

// Export the instance and compatibility functions
export { extensionBus };

// ---------- API Compatible Helper Functions ----------
// These maintain the existing import signatures for gradual migration

/**
 * Publish an event (API compatible with eventBus.publish)
 */
export function publish<E extends ExtensionEvent>(
  event: Omit<E, "timestamp">
): void {
  extensionBus.publish(event);
}

/**
 * Subscribe to events (API compatible with eventBus.subscribe)
 */
export function subscribe<E extends ExtensionEvent>(
  eventTypes: E["type"] | E["type"][],
  handler: (event: E) => void
): ExtensionSubscription {
  return extensionBus.subscribe(eventTypes, handler);
}

/**
 * Get subscription diagnostics
 */
export function getSubscriptionCount(): number {
  return extensionBus.getSubscriptionCount();
}

/**
 * Clean up all subscriptions (should be called on extension deactivation)
 */
export function dispose(): void {
  extensionBus.dispose();
}
