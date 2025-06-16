// Event System for Prompt Manager Extension
import * as vscode from "vscode";

// Generic event interface with discriminated union support
export interface BaseExtensionEvent<
  TType extends string = string,
  TPayload = any
> {
  type: TType;
  payload: TPayload;
  timestamp: number;
  source?: string;
}

// Helper type to extract payload type from an event creator
type EventCreator<T> = T extends (...args: any[]) => {
  type: infer TType;
  payload: infer TPayload;
}
  ? TType extends string
    ? BaseExtensionEvent<TType, TPayload>
    : never
  : never;

// Event creators using `as const` for strong typing
export const Events = {
  // Filesystem Events
  fileCreated: (filePath: string, source?: string) =>
    ({
      type: "filesystem.file.created",
      source,
      payload: {
        filePath,
        fileName: filePath.split(/[/\\]/).pop() || filePath,
      },
    } as const),

  fileDeleted: (filePath: string, source?: string) =>
    ({
      type: "filesystem.file.deleted",
      source,
      payload: {
        filePath,
        fileName: filePath.split(/[/\\]/).pop() || filePath,
      },
    } as const),

  fileChanged: (filePath: string, source?: string) =>
    ({
      type: "filesystem.file.changed",
      source,
      payload: {
        filePath,
        fileName: filePath.split(/[/\\]/).pop() || filePath,
      },
    } as const),

  directoryCreated: (dirPath: string, source?: string) =>
    ({
      type: "filesystem.directory.created",
      source,
      payload: {
        dirPath,
        dirName: dirPath.split(/[/\\]/).pop() || dirPath,
      },
    } as const),

  structureChanged: (
    reason:
      | "file-created"
      | "file-deleted"
      | "file-changed"
      | "directory-created"
      | "manual-refresh",
    affectedPath?: string,
    source?: string
  ) =>
    ({
      type: "filesystem.structure.changed",
      source,
      payload: {
        reason,
        affectedPath,
      },
    } as const),

  // Search Events
  searchCriteriaChanged: (
    query: string,
    scope: "titles" | "content" | "both",
    caseSensitive: boolean,
    isActive: boolean,
    source?: string
  ) =>
    ({
      type: "search.criteria.changed",
      source,
      payload: {
        query,
        scope,
        caseSensitive,
        isActive,
      },
    } as const),

  searchResultsUpdated: (resultCount: number, query: string, source?: string) =>
    ({
      type: "search.results.updated",
      source,
      payload: {
        resultCount,
        query,
      },
    } as const),

  searchCleared: (source?: string) =>
    ({
      type: "search.cleared",
      source,
      payload: {},
    } as const),

  // UI Events
  treeRefreshRequested: (
    reason: "manual" | "file-change" | "search-change",
    source?: string
  ) =>
    ({
      type: "ui.tree.refresh.requested",
      source,
      payload: {
        reason,
      },
    } as const),

  treeItemSelected: (
    itemType: "file" | "folder",
    itemPath: string,
    itemName: string,
    source?: string
  ) =>
    ({
      type: "ui.tree.item.selected",
      source,
      payload: {
        itemType,
        itemPath,
        itemName,
      },
    } as const),

  promptOpened: (filePath: string, source?: string) =>
    ({
      type: "ui.prompt.opened",
      source,
      payload: {
        filePath,
        fileName: filePath.split(/[/\\]/).pop() || filePath,
      },
    } as const),

  promptCreated: (filePath: string, folderPath?: string, source?: string) =>
    ({
      type: "ui.prompt.created",
      source,
      payload: {
        filePath,
        fileName: filePath.split(/[/\\]/).pop() || filePath,
        folderPath,
      },
    } as const),

  // Configuration Events
  configChanged: (
    configKey: string,
    newValue: any,
    oldValue?: any,
    source?: string
  ) =>
    ({
      type: "config.changed",
      source,
      payload: {
        configKey,
        oldValue,
        newValue,
      },
    } as const),

  workspaceChanged: (
    workspaceFolders: readonly vscode.WorkspaceFolder[],
    reason:
      | "folder-added"
      | "folder-removed"
      | "workspace-opened"
      | "workspace-closed",
    source?: string
  ) =>
    ({
      type: "config.workspace.changed",
      source,
      payload: {
        workspaceFolders,
        reason,
      },
    } as const),
};

// Extract all possible event types from the Events object
export type ExtensionEvent = {
  [K in keyof typeof Events]: EventCreator<(typeof Events)[K]>;
}[keyof typeof Events];
