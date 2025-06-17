// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import "reflect-metadata";
import * as vscode from "vscode";
import { PromptController } from "./promptController";
import { PromptTreeProvider } from "./promptTreeProvider";
import { CommandHandler } from "./commandHandler";
import { SearchPanelProvider, SearchCriteria } from "./searchPanelProvider";
import { SearchService } from "./searchService";
import { EXTENSION_CONSTANTS, ConfigurationService } from "./config";
import { publish, subscribe } from "./core/eventBus";
import { Events } from "./core/EventSystem";
import {
  configureDependencies,
  resolve,
  disposeDependencies,
  DI_TOKENS,
} from "./core/di-container";

// Global instances - now resolved from DI container
let configService: ConfigurationService | undefined;
let promptController: PromptController | undefined;
let treeProvider: PromptTreeProvider | undefined;
let commandHandler: CommandHandler | undefined;
let searchProvider: SearchPanelProvider | undefined;
let searchService: SearchService | undefined;

/**
 * This method is called when your extension is activated
 */
export async function activate(context: vscode.ExtensionContext) {
  console.log("Activating Prompt Manager extension...");

  try {
    // Check if we have a workspace
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      console.log("No workspace folder found, setting up workspace listener");
      setupWorkspaceChangeListener(context);
      return; // Exit early, extension will be activated when workspace is opened
    }

    console.log(
      `Workspace detected: ${workspaceFolders.length} folder(s), proceeding...`
    );

    // Set up workspace change listener
    setupWorkspaceChangeListener(context);

    // Initialize extension components
    await initializeExtension(context);

    console.log("Extension activated successfully");
  } catch (error) {
    console.error("Failed to activate extension:", error);
    vscode.window.showErrorMessage(
      `Failed to activate Prompt Manager: ${error}`
    );
  }
}

async function initializeExtension(
  context: vscode.ExtensionContext
): Promise<void> {
  // Configure dependency injection container with all services
  configureDependencies(context);

  // Resolve services from DI container (they will be singletons)
  configService = resolve<ConfigurationService>(DI_TOKENS.ConfigurationService);
  configService.initialize();

  // Resolve business logic layer
  promptController = resolve<PromptController>(DI_TOKENS.PromptController);

  // Resolve presentation layer
  treeProvider = resolve<PromptTreeProvider>(DI_TOKENS.PromptTreeProvider);
  searchProvider = resolve<SearchPanelProvider>(DI_TOKENS.SearchPanelProvider);
  searchService = resolve<SearchService>(DI_TOKENS.SearchService);

  // Resolve command handler
  commandHandler = resolve<CommandHandler>(DI_TOKENS.CommandHandler);

  // Initialize the prompt controller (creates directory structure)
  const initialized = await promptController.initialize();

  if (
    initialized &&
    treeProvider &&
    searchProvider &&
    commandHandler &&
    searchService
  ) {
    // Register tree view
    vscode.window.createTreeView("promptManagerTree", {
      treeDataProvider: treeProvider,
      showCollapseAll: true,
    });

    // Register search panel
    vscode.window.registerWebviewViewProvider(
      "promptManagerSearch",
      searchProvider
    );

    // Connect search events to search service
    if (searchProvider && treeProvider && promptController && searchService) {
      subscribe("search.criteria.changed", async (event) => {
        const searchEvent = event as any; // Type assertion for now
        const criteria: SearchCriteria = {
          query: searchEvent.payload.query,
          scope: searchEvent.payload.scope,
          caseSensitive: searchEvent.payload.caseSensitive,
          isActive: searchEvent.payload.isActive,
        };

        // Update result count in search panel
        if (criteria.isActive) {
          const count = await searchService!.countMatches(criteria);
          searchProvider!.updateResultCount(count);
        }
      });
    }

    // Register all commands
    commandHandler.registerCommands();

    // Configuration is now handled by ConfigurationService
    // which is initialized above and automatically handles config changes

    // Show welcome message for new users
    await showWelcomeMessage(context);

    console.log("Prompt Manager extension activated successfully");
  } else {
    throw new Error("Failed to initialize Prompt Manager");
  }
}

function setupWorkspaceChangeListener(context: vscode.ExtensionContext): void {
  // Listen for workspace folder changes
  const workspaceChangeListener = vscode.workspace.onDidChangeWorkspaceFolders(
    async (event) => {
      console.log("Workspace folders changed:", event);

      const workspaceFolders = vscode.workspace.workspaceFolders;
      const workspaceName = vscode.workspace.name;
      const isWorkspaceFile = vscode.workspace.workspaceFile !== undefined;

      if (workspaceFolders && workspaceFolders.length > 0) {
        if (isWorkspaceFile) {
          console.log(
            `Workspace change: VS Code workspace opened/modified - Name: ${workspaceName}, Folders: ${workspaceFolders.length}`
          );
        } else {
          console.log(
            `Workspace change: Single folder opened - Path: ${workspaceFolders[0].uri.fsPath}`
          );
        }

        // Publish workspace change event
        publish(
          Events.workspaceChanged(
            workspaceFolders,
            "workspace-opened",
            "extension"
          )
        );

        try {
          await initializeExtension(context);
        } catch (error) {
          console.error(
            "Failed to initialize extension after workspace change:",
            error
          );
          vscode.window.showErrorMessage(
            `Failed to initialize Prompt Manager after workspace change: ${error}`
          );
        }
      } else {
        console.log(
          "Workspace change: All workspaces/folders closed, hiding extension..."
        );

        // Publish workspace change event
        publish(Events.workspaceChanged([], "workspace-closed", "extension"));

        // Hide the view when no workspace is open
        vscode.commands.executeCommand(
          "setContext",
          EXTENSION_CONSTANTS.WORKSPACE_HAS_PROMPT_MANAGER,
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
  // Dispose components in reverse order of initialization
  if (treeProvider) {
    treeProvider.dispose();
  }

  if (commandHandler) {
    // CommandHandler doesn't have dispose method, but context subscriptions are handled automatically
  }

  if (promptController) {
    promptController.dispose();
  }

  if (configService) {
    configService.dispose();
  }

  // Dispose the DI container to clean up all singletons
  disposeDependencies();

  // Clear global references
  configService = undefined;
  promptController = undefined;
  treeProvider = undefined;
  commandHandler = undefined;
  searchProvider = undefined;
  searchService = undefined;
}

// This method is called when your extension is deactivated
export function deactivate() {
  console.log("Prompt Manager extension is being deactivated");

  // Clean up resources properly
  cleanup();

  // VSCode automatically disposes of registered commands and tree views
}

async function showWelcomeMessage(
  context: vscode.ExtensionContext
): Promise<void> {
  const hasShownWelcome = context.globalState.get(
    EXTENSION_CONSTANTS.HAS_SHOWN_WELCOME,
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

    // Mark as shown
    await context.globalState.update(
      EXTENSION_CONSTANTS.HAS_SHOWN_WELCOME,
      true
    );
  }
}
