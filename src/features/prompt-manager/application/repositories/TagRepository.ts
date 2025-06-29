import * as vscode from "vscode";
import { Tag } from "@features/prompt-manager/domain/Tag";

/**
 * Repository interface for tag data access
 */
export interface TagRepository {
  /**
   * Get all unique tags from all prompts
   */
  getAll(): Promise<Tag[]>;

  /**
   * Event fired when tag data changes
   */
  onDidChange: vscode.Event<void>;

  /**
   * Notify listeners that tag data has changed
   */
  notifyChanged(): void;
}
