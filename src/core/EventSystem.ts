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
