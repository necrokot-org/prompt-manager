// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { PromptManager } from "./promptManager";
import { PromptTreeProvider } from "./promptTreeProvider";
import { CommandHandler } from "./commandHandler";

// Global instances
let promptManager: PromptManager;
let treeProvider: PromptTreeProvider;
let commandHandler: CommandHandler;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  console.log("Prompt Manager extension is being activated...");

  try {
    // Initialize core components in proper order (following layered architecture)

    // 1. Business Logic Layer
    promptManager = new PromptManager();

    // 2. Presentation Layer
    treeProvider = new PromptTreeProvider(promptManager);

    // 3. Command Handler
    commandHandler = new CommandHandler(promptManager, treeProvider, context);

    // Initialize the prompt manager (creates directory structure)
    const initialized = await promptManager.initialize();

    if (initialized) {
      // Register the tree view
      const treeView = vscode.window.createTreeView("promptManagerTree", {
        treeDataProvider: treeProvider,
        showCollapseAll: true,
      });

      // Add tree view to subscriptions
      context.subscriptions.push(treeView);

      // Register all commands
      commandHandler.registerCommands();

      // Show welcome message for new users
      await showWelcomeMessage(context);

      console.log("Prompt Manager extension activated successfully");
    } else {
      throw new Error("Failed to initialize Prompt Manager");
    }
  } catch (error) {
    console.error("Failed to activate Prompt Manager extension:", error);
    vscode.window.showErrorMessage(
      `Failed to activate Prompt Manager: ${error}`
    );
  }
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
