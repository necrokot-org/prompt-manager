// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import "reflect-metadata";
import * as vscode from "vscode";
import { setup, dispose, Services } from "../../composition/di";
import { PromptTreeView } from "../tree/PromptTreeView";
import { TagTreeView } from "../tree/TagTreeView";
import { SearchPanelView } from "../search/SearchPanelView";
import { CommandHandler } from "../commands/CommandHandler";
import { UI_CONSTANTS } from "../ui-constants";
import { log } from "../../infrastructure/vscode/log";

let services: Services | undefined;
let promptTreeView: PromptTreeView | undefined;
let tagTreeView: TagTreeView | undefined;
let searchPanelView: SearchPanelView | undefined;
let commandHandler: CommandHandler | undefined;

/**
 * This method is called when your extension is activated
 */
export async function activate(context: vscode.ExtensionContext) {
  log.info("Activating Prompt Manager extension (New Architecture)...");

  try {
    // Check if we have a workspace
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      log.debug("No workspace folder found, setting up workspace listener");
      setupWorkspaceChangeListener(context);
      return; // Exit early, extension will be activated when workspace is opened
    }

    log.debug(
      `Workspace detected: ${workspaceFolders.length} folder(s), proceeding...`
    );

    // Set up workspace change listener
    setupWorkspaceChangeListener(context);

    // Wire everything once
    services = setup(context);

    // Set environment context keys
    await Promise.all([
      vscode.commands.executeCommand(
        "setContext",
        "promptManager.isCursor",
        services.env.isCursor()
      ),
      vscode.commands.executeCommand(
        "setContext",
        "promptManager.isWindsurf",
        services.env.isWindsurf()
      ),
      vscode.commands.executeCommand(
        "setContext",
        "promptManager.isVSCode",
        services.env.isVSCode()
      ),
      vscode.commands.executeCommand(
        "setContext",
        "promptManager.isUnknown",
        services.env.isUnknown()
      ),
      vscode.commands.executeCommand(
        "setContext",
        "promptManager.tagFilterActive",
        Boolean(services.tagApp.getActiveTag())
      ),
    ]);

    await services.promptApp.initWorkspace();

    // Enable UI views after successful initialization
    await vscode.commands.executeCommand(
      "setContext",
      UI_CONSTANTS.WORKSPACE_HAS_PROMPT_MANAGER,
      true
    );

    // Views
    promptTreeView = new PromptTreeView(
      services.promptApp,
      services.tagApp,
      services.searchApp,
      services.config
    );
    tagTreeView = new TagTreeView(services.tagApp, services.indexApp);
    searchPanelView = new SearchPanelView(
      services.searchApp,
      context.extensionUri
    );
    commandHandler = new CommandHandler(
      services.promptApp,
      services.tagApp,
      services.searchApp,
      services.indexApp
    );

    // Register UI
    vscode.window.createTreeView(UI_CONSTANTS.TREE_VIEW_ID, {
      treeDataProvider: promptTreeView,
      showCollapseAll: true,
      dragAndDropController: promptTreeView,
    });

    context.subscriptions.push(
      vscode.window.createTreeView(UI_CONSTANTS.TAG_VIEW_ID, {
        treeDataProvider: tagTreeView,
        showCollapseAll: false,
      })
    );

    vscode.window.registerWebviewViewProvider(
      UI_CONSTANTS.SEARCH_VIEW_TYPE,
      searchPanelView
    );

    commandHandler.registerCommands();

    // Keep tag filter context key in sync with tag changes
    const tagFilterContextDisposable = services.tagApp.onTagsChanged(() => {
      vscode.commands.executeCommand(
        "setContext",
        "promptManager.tagFilterActive",
        Boolean(services!.tagApp.getActiveTag())
      );
    });
    context.subscriptions.push(tagFilterContextDisposable);

    await showWelcomeMessage(context);

    log.info("Extension activated successfully");
  } catch (error) {
    log.error("Failed to activate extension:", error);
    vscode.window.showErrorMessage(
      `Failed to activate Prompt Manager: ${error}`
    );
  }
}

function setupWorkspaceChangeListener(context: vscode.ExtensionContext): void {
  const workspaceChangeListener = vscode.workspace.onDidChangeWorkspaceFolders(
    async (event) => {
      log.debug("Workspace folders changed:", event);

      const workspaceFolders = vscode.workspace.workspaceFolders;
      const workspaceName = vscode.workspace.name;
      const isWorkspaceFile = vscode.workspace.workspaceFile !== undefined;

      if (workspaceFolders && workspaceFolders.length > 0) {
        if (isWorkspaceFile) {
          log.info(
            `Workspace opened/modified - Name: ${workspaceName}, Folders: ${workspaceFolders.length}`
          );
        } else {
          log.info(
            `Single folder opened - Path: ${workspaceFolders[0].uri.fsPath}`
          );
        }

        try {
          services = setup(context);
          await services.promptApp.initWorkspace();

          // Enable UI views after successful initialization
          await vscode.commands.executeCommand(
            "setContext",
            UI_CONSTANTS.WORKSPACE_HAS_PROMPT_MANAGER,
            true
          );
        } catch (error) {
          log.error(
            "Failed to initialize extension after workspace change:",
            error
          );
          vscode.window.showErrorMessage(
            `Failed to initialize Prompt Manager after workspace change: ${error}`
          );
        }
      } else {
        log.info(
          "All workspaces/folders closed, hiding Prompt Manager views..."
        );

        // Hide the view when no workspace is open
        vscode.commands.executeCommand(
          "setContext",
          UI_CONSTANTS.WORKSPACE_HAS_PROMPT_MANAGER,
          false
        );

        // Clean up existing instances
        cleanup();
      }
    }
  );

  context.subscriptions.push(workspaceChangeListener);
}

/**
 * Centralized cleanup function for proper resource disposal
 */
function cleanup(): void {
  if (promptTreeView) {
    promptTreeView.dispose();
  }

  if (tagTreeView) {
    tagTreeView.dispose();
  }

  if (searchPanelView) {
    searchPanelView.dispose();
  }

  // Clear global references
  services = undefined;
  promptTreeView = undefined;
  tagTreeView = undefined;
  searchPanelView = undefined;
  commandHandler = undefined;
}

// This method is called when your extension is deactivated
export function deactivate() {
  log.info("Prompt Manager extension is being deactivated");

  cleanup();
  dispose();
}

async function showWelcomeMessage(
  context: vscode.ExtensionContext
): Promise<void> {
  const hasShownWelcome = context.globalState.get(
    UI_CONSTANTS.HAS_SHOWN_WELCOME,
    false
  );

  if (!hasShownWelcome) {
    const action = await vscode.window.showInformationMessage(
      "Welcome to Prompt Manager! This extension helps you organize and manage your LLM prompts.",
      "Create First Prompt",
      "Learn More"
    );

    if (action === "Create First Prompt") {
      vscode.commands.executeCommand("promptManager.addPrompt");
    } else if (action === "Learn More") {
      vscode.env.openExternal(
        vscode.Uri.parse("https://github.com/your-repo/prompt-manager#readme")
      );
    }

    await context.globalState.update(UI_CONSTANTS.HAS_SHOWN_WELCOME, true);
  }
}
