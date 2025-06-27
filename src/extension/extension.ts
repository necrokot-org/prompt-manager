// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import "reflect-metadata";
import * as vscode from "vscode";
import { PromptController } from "@features/prompt-manager/domain/promptController";
import { PromptTreeProvider } from "@features/prompt-manager/ui/tree/PromptTreeProvider";
import { CommandHandler } from "@ext/commands/commandHandler";
import {
  SearchPanelProvider,
  SearchCriteria,
} from "@features/search/ui/SearchPanelProvider";
import { SearchService } from "@features/search/services/searchService";
import {
  EXTENSION_CONSTANTS,
  ConfigurationService,
} from "@infra/config/config";
import { eventBus } from "@infra/vscode/ExtensionBus";
import {
  setupDependencyInjection,
  container,
  DI_TOKENS,
} from "@infra/di/di-container";
import { log } from "@infra/vscode/log";
import { EnvironmentDetector } from "@infra/config/EnvironmentDetector";

// Global instances - now resolved from DI container
let configService: ConfigurationService | undefined;
let promptController: PromptController | undefined;
let treeProvider: PromptTreeProvider | undefined;
let commandHandler: CommandHandler | undefined;
let searchProvider: SearchPanelProvider | undefined;
let searchService: SearchService | undefined;
let environmentDetector: EnvironmentDetector | undefined;

/**
 * This method is called when your extension is activated
 */
export async function activate(context: vscode.ExtensionContext) {
  log.info("Activating Prompt Manager extension...");

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

    // Initialize extension components
    await initializeExtension(context);

    log.info("Extension activated successfully");
  } catch (error) {
    log.error("Failed to activate extension:", error);
    vscode.window.showErrorMessage(
      `Failed to activate Prompt Manager: ${error}`
    );
  }
}

async function initializeExtension(
  context: vscode.ExtensionContext
): Promise<void> {
  // Configure dependency injection container with all services
  setupDependencyInjection(context);

  // Resolve services from DI container (they will be singletons)
  configService = container.resolve<ConfigurationService>(
    DI_TOKENS.ConfigurationService
  );
  configService.initialize();

  // Resolve business logic layer
  promptController = container.resolve<PromptController>(
    DI_TOKENS.PromptController
  );

  // Resolve presentation layer
  treeProvider = container.resolve<PromptTreeProvider>(
    DI_TOKENS.PromptTreeProvider
  );
  searchProvider = container.resolve<SearchPanelProvider>(
    DI_TOKENS.SearchPanelProvider
  );
  searchService = container.resolve<SearchService>(DI_TOKENS.SearchService);

  // Resolve command handler
  commandHandler = container.resolve<CommandHandler>(DI_TOKENS.CommandHandler);

  // Resolve environment detector
  environmentDetector = container.resolve<EnvironmentDetector>(
    DI_TOKENS.EnvironmentDetector
  );

  // Set environment context keys for VS Code 'when' clauses
  await Promise.all([
    vscode.commands.executeCommand(
      "setContext",
      "promptManager.isCursor",
      environmentDetector.isCursor()
    ),
    vscode.commands.executeCommand(
      "setContext",
      "promptManager.isWindserf",
      environmentDetector.isWindserf()
    ),
    vscode.commands.executeCommand(
      "setContext",
      "promptManager.isVSCode",
      environmentDetector.isVSCode()
    ),
    vscode.commands.executeCommand(
      "setContext",
      "promptManager.isUnknown",
      environmentDetector.isUnknown()
    ),
  ]);

  const detectedEnv = environmentDetector.getEnvironment();
  log.info(`Environment detected: ${detectedEnv}`);

  // Show warning for unknown environments
  if (environmentDetector.isUnknown()) {
    const message =
      "Unknown editor environment detected. Some features may not work as expected.";
    log.warn(message);
    vscode.window.showWarningMessage(message);
  }

  // Initialize the prompt controller (creates directory structure)
  const initialized = await promptController.initialize();

  if (
    initialized &&
    treeProvider &&
    searchProvider &&
    commandHandler &&
    searchService
  ) {
    // Register tree view with drag and drop support
    vscode.window.createTreeView("promptManagerTree", {
      treeDataProvider: treeProvider,
      showCollapseAll: true,
      dragAndDropController: treeProvider,
    });

    // Register search panel
    vscode.window.registerWebviewViewProvider(
      "promptManagerSearch",
      searchProvider
    );

    // Connect search events to search service
    if (searchProvider && treeProvider && promptController && searchService) {
      eventBus.on("search.criteria.changed", async (payload) => {
        const criteria: SearchCriteria = {
          query: payload.query,
          scope: payload.scope,
          caseSensitive: payload.caseSensitive,
          isActive: payload.isActive,
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

    log.info("Prompt Manager extension activated successfully");
  } else {
    throw new Error("Failed to initialize Prompt Manager");
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

        // Publish workspace change event
        eventBus.emit("config.workspace.changed", {
          workspaceFolders,
          reason: "workspace-opened",
        });

        try {
          await initializeExtension(context);
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

        // Publish workspace change event
        eventBus.emit("config.workspace.changed", {
          workspaceFolders: [],
          reason: "workspace-closed",
        });

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
  if (treeProvider) {
    treeProvider.dispose();
  }

  if (promptController) {
    promptController.dispose();
  }

  if (configService) {
    configService.dispose();
  }

  // Clear global references
  configService = undefined;
  promptController = undefined;
  treeProvider = undefined;
  commandHandler = undefined;
  searchProvider = undefined;
  searchService = undefined;
  environmentDetector = undefined;
}

// This method is called when your extension is deactivated
export function deactivate() {
  log.info("Prompt Manager extension is being deactivated");

  cleanup();

  // Dispose event bus subscriptions to prevent memory leaks
  eventBus.dispose();
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

    await context.globalState.update(
      EXTENSION_CONSTANTS.HAS_SHOWN_WELCOME,
      true
    );
  }
}
