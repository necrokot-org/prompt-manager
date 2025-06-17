import * as vscode from "vscode";

// ---------------------------------------------------------------------------
// Typed Event Map -----------------------------------------------------------
// ---------------------------------------------------------------------------

export interface EventMap {
  // Filesystem
  "filesystem.file.created": { filePath: string; fileName: string };
  "filesystem.file.deleted": { filePath: string; fileName: string };
  "filesystem.file.changed": { filePath: string; fileName: string };
  "filesystem.directory.created": { dirPath: string; dirName: string };

  // Search
  "search.criteria.changed": {
    query: string;
    scope: "titles" | "content" | "both";
    caseSensitive: boolean;
    isActive: boolean;
  };
  "search.results.updated": { resultCount: number; query: string };
  "search.cleared": {};

  // UI
  "ui.tree.refresh.requested": {
    reason: "manual" | "file-change" | "search-change";
  };
  "ui.tree.item.selected": {
    itemType: "file" | "folder";
    itemPath: string;
    itemName: string;
  };
  "ui.prompt.opened": { filePath: string; fileName: string };
  "ui.prompt.created": {
    filePath: string;
    fileName: string;
    folderPath?: string;
  };

  // Config
  "config.changed": { configKey: string; newValue: any; oldValue?: any };
  "config.workspace.changed": {
    workspaceFolders: readonly vscode.WorkspaceFolder[];
    reason:
      | "folder-added"
      | "folder-removed"
      | "workspace-opened"
      | "workspace-closed";
  };
}

type EventKey = keyof EventMap;

export interface ExtensionSubscription extends vscode.Disposable {
  unsubscribe(): void;
}

class EventBus {
  private readonly emitter = new vscode.EventEmitter<{
    key: EventKey;
    payload: any;
  }>();

  /** Emit an event with typed payload */
  emit<K extends EventKey>(key: K, payload: EventMap[K]): void {
    this.emitter.fire({ key, payload });
  }

  /** Listen for event */
  on<K extends EventKey>(
    key: K,
    handler: (payload: EventMap[K]) => void
  ): ExtensionSubscription {
    const disposable = this.emitter.event((e) => {
      if (e.key === key) {
        handler(e.payload as EventMap[K]);
      }
    });

    return {
      unsubscribe: () => disposable.dispose(),
      dispose: () => disposable.dispose(),
    } as ExtensionSubscription;
  }

  /** Listen once */
  once<K extends EventKey>(
    key: K,
    handler: (payload: EventMap[K]) => void
  ): ExtensionSubscription {
    const sub = this.on(key, (p) => {
      try {
        handler(p);
      } finally {
        sub.dispose();
      }
    });
    return sub;
  }

  /** Wait for event */
  waitFor<K extends EventKey>(
    key: K,
    predicate?: (payload: EventMap[K]) => boolean,
    timeoutMs?: number
  ): Promise<EventMap[K]> {
    return new Promise((resolve, reject) => {
      const sub = this.on(key, (payload) => {
        if (!predicate || predicate(payload)) {
          sub.dispose();
          if (timeout) clearTimeout(timeout);
          resolve(payload);
        }
      });

      let timeout: NodeJS.Timeout | undefined;
      if (timeoutMs) {
        timeout = setTimeout(() => {
          sub.dispose();
          reject(new Error("EventBus.waitFor timeout"));
        }, timeoutMs);
      }
    });
  }

  dispose(): void {
    this.emitter.dispose();
  }
}

export const eventBus = new EventBus();

// Convenience re-exports ----------------------------------------------------
export type { EventKey };
// ---------------------------------------------------------------------------
