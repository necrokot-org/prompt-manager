import * as vscode from "vscode";

import { CONFIG_KEYS } from "@infra/config/config";

// Singleton OutputChannel for the entire extension. In unit-test environments
// the VS Code API might be stubbed. Provide a graceful fallback to prevent
// crashes when `createOutputChannel` is unavailable.
const outputChannel: vscode.OutputChannel & {
  appendLine: (value: string) => void;
  show: (preserveFocus?: boolean) => void;
} =
  typeof vscode.window !== "undefined" &&
  // @ts-ignore - runtime check
  typeof vscode.window.createOutputChannel === "function"
    ? vscode.window.createOutputChannel("Prompt Manager")
    : // Fallback: emulate minimal OutputChannel interface using console
      ({
        appendLine: console.log,
        show: () => {},
      } as unknown as vscode.OutputChannel);

/**
 * Get current debug logging status from VS Code configuration
 */
function getDebugEnabled(): boolean {
  try {
    const config = vscode.workspace.getConfiguration("promptManager");
    return config.get<boolean>(CONFIG_KEYS.DEBUG_LOGGING, false);
  } catch {
    // Fallback if VS Code API is not available (e.g., during tests)
    return true;
  }
}

/**
 * Format a log entry with ISO timestamp and level prefix
 */
function format(level: string, message: string): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level}] ${message}`;
}

function toString(...args: unknown[]): string {
  return args
    .map((arg) => {
      if (typeof arg === "string") {
        return arg;
      }
      try {
        return JSON.stringify(arg, null, 2);
      } catch {
        return String(arg);
      }
    })
    .join(" ");
}

function logLine(
  level: "DEBUG" | "INFO" | "WARN" | "ERROR",
  ...args: unknown[]
): void {
  if (level === "DEBUG" && !getDebugEnabled()) {
    return; // Skip debug messages when disabled
  }

  const line = format(level, toString(...args));
  outputChannel.appendLine(line);

  // For ERROR level also reveal the channel so the user can see failures easily
  if (level === "ERROR") {
    outputChannel.show(true);
  }
}

export const log = {
  debug: (...args: unknown[]) => logLine("DEBUG", ...args),
  info: (...args: unknown[]) => logLine("INFO", ...args),
  warn: (...args: unknown[]) => logLine("WARN", ...args),
  error: (...args: unknown[]) => logLine("ERROR", ...args),
};
