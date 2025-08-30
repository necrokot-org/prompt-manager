import * as vscode from "vscode";
import { injectable } from "tsyringe";

/**
 * Supported editor environments for the prompt manager
 */
export enum Environment {
  VSCode = "vscode",
  Cursor = "cursor",
  Windsurf = "windsurf",
  Unknown = "unknown",
}

/**
 * VS Code environment interface for dependency injection
 */
export interface VSCodeEnv {
  appName?: string;
  appHost?: string;
}

/**
 * Environment detection service
 *
 * Detects VS Code, Cursor, and Windsurf editors at runtime using:
 * 1. vscode.env.appHost (prioritized - more reliable host identification)
 * 2. vscode.env.appName (fallback - may vary between editors)
 *
 * Uses word boundary detection to prevent false positives.
 * Results are cached at initialization for performance.
 */
@injectable()
export class EnvironmentDetector {
  /**
   * Detected environment (cached after first detection)
   */
  private _env: Environment | null = null;

  /**
   * Create an EnvironmentDetector instance
   * @param vscodeEnv - VS Code environment object (defaults to real vscode.env)
   */
  constructor(private readonly vscodeEnv: VSCodeEnv = vscode.env) {}

  /**
   * Get the detected environment
   * @returns The current editor environment
   */
  getEnvironment(): Environment {
    if (this._env === null) {
      this._env = this.detect();
    }
    return this._env;
  }

  /**
   * Check if running in VS Code
   * @returns true if the current environment is VS Code
   */
  isVSCode(): boolean {
    return this.getEnvironment() === Environment.VSCode;
  }

  /**
   * Check if running in Cursor
   * @returns true if the current environment is Cursor
   */
  isCursor(): boolean {
    return this.getEnvironment() === Environment.Cursor;
  }

  /**
   * Check if running in Windsurf
   * @returns true if the current environment is Windsurf
   */
  isWindsurf(): boolean {
    return this.getEnvironment() === Environment.Windsurf;
  }

  /**
   * Check if running in an unknown environment
   * @returns true if the current environment is unknown
   */
  isUnknown(): boolean {
    return this.getEnvironment() === Environment.Unknown;
  }

  /**
   * Internal method to detect the current environment
   *
   * Priority order:
   * 1. Check vscode.env.appHost (most reliable)
   * 2. Check vscode.env.appName (fallback)
   * 3. Return Unknown if no matches found
   *
   * Uses word boundaries to avoid false positives (e.g., "precursor" matching "cursor")
   *
   * @returns The detected environment or Unknown for unrecognized hosts
   */
  private detect(): Environment {
    // Get both host and name properties with fallbacks
    const appHost = this.vscodeEnv.appHost ?? "";
    const appName = this.vscodeEnv.appName ?? "";

    // Prioritize appHost over appName for more reliable detection
    const hostLower = appHost.toLowerCase();
    const nameLower = appName.toLowerCase();

    // Check appHost first (higher priority)
    if (hostLower) {
      // Use word boundaries to avoid false positives
      if (/(^|\W)cursor($|\W)/.test(hostLower)) {
        return Environment.Cursor;
      }
      if (/(^|\W)windsurf($|\W)/.test(hostLower)) {
        return Environment.Windsurf;
      }
      if (/(^|\W)(vscode|visual\s*studio\s*code)($|\W)/.test(hostLower)) {
        return Environment.VSCode;
      }
    }

    // Fall back to appName if appHost doesn't match
    if (nameLower) {
      // Use word boundaries to avoid false positives
      if (/(^|\W)cursor($|\W)/.test(nameLower)) {
        return Environment.Cursor;
      }
      if (/(^|\W)windsurf($|\W)/.test(nameLower)) {
        return Environment.Windsurf;
      }
      if (/(^|\W)(vscode|visual\s*studio\s*code)($|\W)/.test(nameLower)) {
        return Environment.VSCode;
      }
    }

    // Return Unknown for unrecognized environments instead of silent fallback
    return Environment.Unknown;
  }
}
