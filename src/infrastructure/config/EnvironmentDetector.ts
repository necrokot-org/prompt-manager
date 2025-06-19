import * as vscode from "vscode";
import { injectable } from "tsyringe";
import { Environment, EnvironmentDetector } from "./environment";

/**
 * Implementation of environment detection service
 * Detects VS Code, Cursor, and Windserf editors at runtime
 */
@injectable()
export class EnvironmentDetectorImpl implements EnvironmentDetector {
  /**
   * Detected environment (cached at initialization)
   */
  private readonly env: Environment = this.detect();

  /**
   * Get the detected environment
   * @returns The current editor environment
   */
  getEnvironment(): Environment {
    return this.env;
  }

  /**
   * Check if running in VS Code
   * @returns true if the current environment is VS Code
   */
  isVSCode(): boolean {
    return this.env === Environment.VSCode;
  }

  /**
   * Check if running in Cursor
   * @returns true if the current environment is Cursor
   */
  isCursor(): boolean {
    return this.env === Environment.Cursor;
  }

  /**
   * Check if running in Windserf
   * @returns true if the current environment is Windserf
   */
  isWindserf(): boolean {
    return this.env === Environment.Windserf;
  }

  /**
   * Check if running in an unknown environment
   * @returns true if the current environment is unknown
   */
  isUnknown(): boolean {
    return this.env === Environment.Unknown;
  }

  /**
   * Internal method to detect the current environment
   * Uses VS Code API properties to identify the host editor
   * @returns The detected environment or Unknown for unrecognized hosts
   */
  private detect(): Environment {
    // Try multiple detection methods for reliability
    const host = (vscode.env as any).appHost ?? vscode.env.appName ?? "";
    const name = host.toLowerCase();

    // Use word boundaries to avoid false positives (e.g., "precursor" matching "cursor")
    // Check for Cursor editor
    if (/(^|\W)cursor($|\W)/.test(name)) {
      return Environment.Cursor;
    }

    // Check for Windserf editor
    if (/(^|\W)windserf($|\W)/.test(name)) {
      return Environment.Windserf;
    }

    // Check for VS Code (various possible names)
    if (/(^|\W)(vscode|visual\s*studio\s*code)($|\W)/.test(name)) {
      return Environment.VSCode;
    }

    // Return Unknown for unrecognized environments instead of silent fallback
    return Environment.Unknown;
  }
}
