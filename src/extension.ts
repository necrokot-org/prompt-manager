// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { PromptController } from "./promptController";
import { PromptTreeProvider } from "./promptTreeProvider";
import { CommandHandler } from "./commandHandler";
import { SearchPanelProvider, SearchCriteria } from "./searchPanelProvider";
import { PromptFile } from "./fileManager";
import { SearchService } from "./searchService";

// Global instances
let promptController: PromptController | undefined;
let treeProvider: PromptTreeProvider | undefined;
let commandHandler: CommandHandler | undefined;
let searchProvider: SearchPanelProvider | undefined;
let searchService: SearchService | undefined;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  console.log("Prompt Manager extension is being activated...");

  try {
    // Enhanced workspace/folder detection
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const workspaceName = vscode.workspace.name;
    const isWorkspaceFile = vscode.workspace.workspaceFile !== undefined;

    if (!workspaceFolders || workspaceFolders.length === 0) {
      console.log(
        "Extension: No workspace or folder open, waiting for workspace/folder to be opened..."
      );
      // Set context to hide the view when no workspace is open
      vscode.commands.executeCommand(
        "setContext",
        "workspaceHasPromptManager",
        false
      );

      // Listen for workspace changes
      setupWorkspaceChangeListener(context);
      return;
    }

    await initializeExtension(context);

    // Listen for workspace changes
    setupWorkspaceChangeListener(context);
  } catch (error) {
    console.error("Failed to activate Prompt Manager extension:", error);
    vscode.window.showErrorMessage(
      `Failed to activate Prompt Manager: ${error}`
    );
  }
}

async function initializeExtension(
  context: vscode.ExtensionContext
): Promise<void> {
  // Initialize core components in proper order (following layered architecture)

  // 1. Business Logic Layer
  promptController = new PromptController();

  // 2. Presentation Layer
  treeProvider = new PromptTreeProvider(promptController);
  searchProvider = new SearchPanelProvider(context.extensionUri);
  searchService = new SearchService(
    promptController.getRepository().getFileManager()
  );

  // 3. Command Handler
  commandHandler = new CommandHandler(promptController, context);

  // Initialize the prompt controller (creates directory structure)
  const initialized = await promptController.initialize();

  if (initialized) {
    // Register the tree view
    const treeView = vscode.window.createTreeView("promptManagerTree", {
      treeDataProvider: treeProvider,
      showCollapseAll: true,
    });

    // Register the search webview
    const searchWebviewProvider = vscode.window.registerWebviewViewProvider(
      SearchPanelProvider.viewType,
      searchProvider
    );

    // Add to subscriptions
    context.subscriptions.push(treeView, searchWebviewProvider);

    // Connect search provider to tree provider
    if (searchProvider && treeProvider && promptController && searchService) {
      searchProvider.onDidChangeSearch(async (criteria) => {
        treeProvider!.setSearchCriteria(criteria.isActive ? criteria : null);

        // Update result count in search panel
        if (criteria.isActive) {
          try {
            const count = await searchService!.countMatches(criteria);
            searchProvider!.updateResultCount(count);
          } catch (error) {
            console.error("Error counting search results:", error);
            // Fallback to simple count
            const structure = await promptController!.getPromptStructure();
            let count = 0;

            // Count matching root prompts
            for (const prompt of structure.rootPrompts) {
              if (searchService!.matchesTextFallback(prompt, criteria)) {
                count++;
              }
            }

            // Count matching prompts in folders
            for (const folder of structure.folders) {
              for (const prompt of folder.prompts) {
                if (searchService!.matchesTextFallback(prompt, criteria)) {
                  count++;
                }
              }
            }

            searchProvider!.updateResultCount(count);
          }
        }
      });
    }

    // Register all commands
    commandHandler.registerCommands();

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
        // Hide the view when no workspace is open
        vscode.commands.executeCommand(
          "setContext",
          "workspaceHasPromptManager",
          false
        );

        // Clean up existing instances
        promptController = undefined;
        treeProvider = undefined;
        commandHandler = undefined;
        searchProvider = undefined;
        searchService = undefined;
      }
    }
  );

  context.subscriptions.push(workspaceChangeListener);
}

// This method is called when your extension is deactivated
export function deactivate() {
  console.log("Prompt Manager extension is being deactivated");

  // Clean up resources if needed
  // VSCode automatically disposes of registered commands and tree views
}

async function showWelcomeMessage(
  context: vscode.ExtensionContext
): Promise<void> {
  const hasShownWelcome = context.globalState.get(
    "promptManager.hasShownWelcome",
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
    await context.globalState.update("promptManager.hasShownWelcome", true);
  }
}
