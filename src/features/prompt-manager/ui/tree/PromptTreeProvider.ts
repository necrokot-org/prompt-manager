import * as vscode from "vscode";
import * as path from "path";
import { injectable, inject } from "tsyringe";
import { PromptController } from "@features/prompt-manager/domain/promptController";
import {
  PromptFile,
  PromptFolder,
} from "@features/prompt-manager/data/fileManager";
import { ConfigurationService } from "@infra/config/config";
import { eventBus } from "@infra/vscode/ExtensionBus";
import { log } from "@infra/vscode/log";
import { DI_TOKENS } from "@infra/di/di-tokens";
import {
  FileTreeItem,
  FolderTreeItem,
  EmptyStateTreeItem,
} from "@features/prompt-manager/ui/tree/items";
import { ItemFactory } from "@features/prompt-manager/ui/tree/factory/ItemFactory";
import { FileSystemManager } from "@infra/fs/FileSystemManager";
import { FilterCoordinator } from "@features/prompt-manager/application/filters/FilterCoordinator";

// NOTE: The tree item classes (FileTreeItem, FolderTreeItem, EmptyStateTreeItem) have
// been extracted to dedicated modules under `src/tree/items/` to improve
// separation of concerns and unit-testability.

export type PromptTreeItem = FileTreeItem | FolderTreeItem | EmptyStateTreeItem;

@injectable()
export class PromptTreeProvider
  implements
    vscode.TreeDataProvider<PromptTreeItem>,
    vscode.TreeDragAndDropController<PromptTreeItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    PromptTreeItem | undefined | void
  > = new vscode.EventEmitter<PromptTreeItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<
    PromptTreeItem | undefined | void
  > = this._onDidChangeTreeData.event;

  // TreeDragAndDropController properties
  dropMimeTypes = ["application/vnd.code.tree.promptmanager"];
  dragMimeTypes = ["application/vnd.code.tree.promptmanager"];

  private itemFactory: ItemFactory;
  private subscriptions: any[] = [];

  constructor(
    @inject(DI_TOKENS.PromptController)
    private promptController: PromptController,
    @inject(DI_TOKENS.ConfigurationService)
    private configurationService: ConfigurationService,
    @inject(DI_TOKENS.FileSystemManager)
    private fileSystemManager: FileSystemManager,
    @inject(DI_TOKENS.FilterCoordinator)
    private filterCoordinator: FilterCoordinator
  ) {
    // Initialize modular helpers
    this.itemFactory = new ItemFactory(this.configurationService);

    // Listen to tree refresh events
    this.subscriptions.push(
      eventBus.on("ui.tree.refresh.requested", () => {
        this.refresh();
      })
    );

    // Listen to filter changes (search criteria changes and tag changes will trigger refresh)
    this.subscriptions.push(
      eventBus.on("search.criteria.changed", () => {
        this.refresh();
      })
    );

    this.subscriptions.push(
      eventBus.on("search.cleared", () => {
        this.refresh();
      })
    );
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: PromptTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: PromptTreeItem): Promise<PromptTreeItem[]> {
    if (!element) {
      // Root level - return files and folders (no tags root)
      return this.getRootItems();
    }

    if (element instanceof FolderTreeItem) {
      // Return prompts and subfolders in this folder
      return this.getFolderItems(element.promptFolder);
    }

    return [];
  }

  private async getRootItems(): Promise<PromptTreeItem[]> {
    try {
      log.debug("getRootItems: Starting to get prompt structure");
      const structure = await this.promptController.getPromptStructure();
      log.debug("getRootItems: Got structure", {
        foldersCount: structure?.folders?.length || 0,
        rootPromptsCount: structure?.rootPrompts?.length || 0,
        structure,
      });

      // Use FilterCoordinator to get filtered prompts
      const filteredPrompts = await this.filterCoordinator.filterAll(structure);

      const items: PromptTreeItem[] = [];

      // Check if any filters are actually active (regardless of result count)
      const filtersActive = this.filterCoordinator.hasActiveFilters();

      if (filtersActive) {
        log.debug("getRootItems: Filters are active, showing filtered prompts");
        for (const prompt of filteredPrompts) {
          if (prompt && prompt.title) {
            const promptItem = this.createFileTreeItem(prompt, {
              command: "promptManager.openPrompt",
              title: "Open Prompt",
              arguments: [prompt.path],
            });
            items.push(promptItem);
            log.debug(
              "getRootItems: Added filtered prompt item:",
              prompt.title
            );
          }
        }

        // Show empty state if no matches
        if (items.length === 0) {
          items.push(
            this.itemFactory.createEmptyStateItem(
              "No matching prompts",
              "Try adjusting your search criteria or tag filters",
              "emptyFiltered"
            )
          );
        }

        return items;
      }

      // If no filters are active, show normal folder structure
      // Add folders that are in the root (no parent folders)
      if (structure?.folders) {
        log.debug("getRootItems: Processing folders");
        const basePromptPath = this.promptController
          .getRepository()
          .getFileManager()
          .getPromptManagerPath();

        for (const folder of structure.folders) {
          log.debug("getRootItems: Processing folder:", folder);
          if (folder && folder.name) {
            // Only show folders whose parent is the root prompt manager directory
            const parentPath = path.dirname(folder.path);
            if (parentPath === basePromptPath) {
              const folderItem = this.itemFactory.createFolderTreeItem(folder);
              items.push(folderItem);
              log.debug("getRootItems: Added root folder item:", folder.name);
            }
          } else {
            log.warn("FolderTreeItem: Skipping invalid folder:", folder);
          }
        }
      }

      // Add root prompts
      if (structure?.rootPrompts) {
        log.debug("getRootItems: Processing root prompts");
        for (const prompt of structure.rootPrompts) {
          log.debug("getRootItems: Processing prompt:", prompt);
          if (prompt && prompt.title) {
            const promptItem = this.createFileTreeItem(prompt, {
              command: "promptManager.openPrompt",
              title: "Open Prompt",
              arguments: [prompt.path],
            });
            items.push(promptItem);
            log.debug("getRootItems: Added prompt item:", prompt.title);
          } else {
            log.warn("FileTreeItem: Skipping invalid prompt:", prompt);
          }
        }
      }

      // If no items, show empty state message
      if (items.length === 0) {
        log.debug("getRootItems: No items found, showing empty state");
        items.push(
          this.itemFactory.createEmptyStateItem(
            "No prompts yet",
            "Click + to add your first prompt",
            "emptyState"
          )
        );
      }

      log.debug("getRootItems: Returning items", { count: items.length });
      return items;
    } catch (error) {
      log.error("Error in getRootItems:", error);
      vscode.window.showErrorMessage(`Error getting root items: ${error}`);
      return [
        new EmptyStateTreeItem(
          "Error loading prompts",
          "Check console for details",
          "error"
        ),
      ];
    }
  }

  private async getFolderItems(
    folder: PromptFolder
  ): Promise<PromptTreeItem[]> {
    const items: PromptTreeItem[] = [];
    const structure = await this.promptController.getPromptStructure();

    // Add child folders (folders whose parent path equals this folder's path)
    if (structure?.folders) {
      for (const childFolder of structure.folders) {
        const childParentPath = path.dirname(childFolder.path);
        if (childParentPath === folder.path) {
          const folderItem = this.itemFactory.createFolderTreeItem(childFolder);
          items.push(folderItem);
        }
      }
    }

    // Add prompts directly in this folder
    if (folder.prompts && folder.prompts.length > 0) {
      for (const prompt of folder.prompts) {
        const promptItem = this.createFileTreeItem(prompt, {
          command: "promptManager.openPrompt",
          title: "Open Prompt",
          arguments: [prompt.path],
        });
        items.push(promptItem);
      }
    }

    // If no items, show empty state
    if (items.length === 0) {
      items.push(
        this.itemFactory.createEmptyStateItem(
          "Empty folder",
          "Add prompts or subfolders",
          "emptyFolder"
        )
      );
    }

    return items;
  }

  private createFileTreeItem(
    promptFile: PromptFile,
    command?: vscode.Command
  ): FileTreeItem {
    return this.itemFactory.createFileTreeItem(promptFile, command);
  }

  async handleDrag(
    source: readonly PromptTreeItem[],
    dataTransfer: vscode.DataTransfer
  ): Promise<void> {
    const dragged = source[0];
    if (!dragged) {
      return;
    }

    let dragData: any;
    if (dragged instanceof FileTreeItem) {
      dragData = {
        type: "file",
        path: dragged.promptFile.path,
        title: dragged.promptFile.title,
        name: dragged.promptFile.name,
      };
    } else if (dragged instanceof FolderTreeItem) {
      dragData = {
        type: "folder",
        path: dragged.promptFolder.path,
        name: dragged.promptFolder.name,
      };
    }

    if (dragData) {
      dataTransfer.set(
        "application/vnd.code.tree.promptmanager",
        new vscode.DataTransferItem(dragData)
      );

      eventBus.emit("dragdrop.drag.started", {
        file: dragData,
        timestamp: Date.now(),
      });
    }
  }

  async handleDrop(
    target: PromptTreeItem | undefined,
    dataTransfer: vscode.DataTransfer
  ): Promise<void> {
    const transferItem = dataTransfer.get(
      "application/vnd.code.tree.promptmanager"
    );
    if (!transferItem) {
      return;
    }

    const dragData = transferItem.value;
    if (!dragData) {
      return;
    }

    try {
      let targetPath: string;

      if (target instanceof FolderTreeItem) {
        targetPath = target.promptFolder.path;
      } else if (target === undefined) {
        // Dropped on root
        const rootPath = this.promptController
          .getRepository()
          .getFileManager()
          .getPromptManagerPath();
        if (!rootPath) {
          vscode.window.showErrorMessage("No prompt manager root path found");
          return;
        }
        targetPath = rootPath;
      } else {
        vscode.window.showWarningMessage(
          "Can only drop items onto folders or the root area"
        );
        return;
      }

      const sourcePath = dragData.path;
      const sourcePathInfo = path.parse(sourcePath);
      const newPath = path.join(targetPath, sourcePathInfo.base);

      // Check for move conflicts
      const conflictCheck = await this.fileSystemManager.checkMoveConflict(
        sourcePath,
        newPath
      );

      if (conflictCheck.hasConflict) {
        let errorMessage = "";
        switch (conflictCheck.conflictType) {
          case "source_not_found":
            errorMessage = "Source file or folder not found";
            break;
          case "target_exists":
            errorMessage = `A ${dragData.type} with that name already exists in the target location`;
            break;
          case "same_location":
            errorMessage = "Cannot move item to the same location";
            break;
          default:
            errorMessage = "Cannot move item due to a conflict";
        }
        vscode.window.showErrorMessage(errorMessage);
        return;
      }

      // Perform the move based on type
      if (dragData.type === "file") {
        await this.fileSystemManager.moveFile(sourcePath, newPath);
      } else if (dragData.type === "folder") {
        await this.fileSystemManager.moveFolder(sourcePath, newPath);
      } else {
        throw new Error(`Unknown drag data type: ${dragData.type}`);
      }

      // Refresh the tree
      this.refresh();

      eventBus.emit("dragdrop.operation.completed", {
        command: "move",
        result: { from: sourcePath, to: newPath },
        operation: dragData,
      });

      vscode.window.showInformationMessage(
        `Moved ${dragData.type} "${
          dragData.name || dragData.title
        }" successfully`
      );
    } catch (error) {
      log.error("handleDrop: Error during drop operation:", error);
      vscode.window.showErrorMessage(`Failed to move item: ${error}`);

      eventBus.emit("dragdrop.operation.failed", {
        command: "move",
        result: null,
        error: error as Error,
      });
    } finally {
      eventBus.emit("dragdrop.state.cleared", { timestamp: Date.now() });
    }
  }

  public dispose(): void {
    this.subscriptions.forEach((sub) => {
      if (typeof sub.dispose === "function") {
        sub.dispose();
      }
    });
  }
}
