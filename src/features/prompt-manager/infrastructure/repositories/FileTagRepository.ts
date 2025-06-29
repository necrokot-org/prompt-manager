import { injectable, inject } from "tsyringe";
import * as vscode from "vscode";
import { Tag } from "@features/prompt-manager/domain/Tag";
import { TagExtractor } from "@features/prompt-manager/domain/TagExtractor";
import { TagRepository } from "@features/prompt-manager/application/repositories/TagRepository";
import { PromptRepository } from "@features/prompt-manager/domain/promptRepository";
import { DI_TOKENS } from "@infra/di/di-tokens";

/**
 * Implementation of TagRepository that derives tags from PromptRepository
 */
@injectable()
export class FileTagRepository implements TagRepository {
  private _onDidChange: vscode.EventEmitter<void> =
    new vscode.EventEmitter<void>();
  readonly onDidChange: vscode.Event<void> = this._onDidChange.event;

  constructor(
    @inject(DI_TOKENS.PromptRepository)
    private promptRepository: PromptRepository,
    @inject(DI_TOKENS.TagExtractor)
    private tagExtractor: TagExtractor
  ) {
    // The actual event listening will be set up through the event bus
    // when file system changes occur
  }

  /**
   * Get all unique tags from all prompts
   */
  public async getAll(): Promise<Tag[]> {
    try {
      const structure = await this.promptRepository.getPromptStructure();
      const allPrompts = [
        ...structure.rootPrompts,
        ...structure.folders.flatMap((f) => f.prompts),
      ];

      const tagSet = await this.tagExtractor.extractFromPrompts(allPrompts);
      return this.tagExtractor
        .getTagsAsArray(tagSet)
        .map((tagValue) => Tag.from(tagValue));
    } catch (error) {
      // Return empty array if extraction fails
      return [];
    }
  }

  /**
   * Notify listeners that tags have changed
   */
  public notifyChanged(): void {
    this._onDidChange.fire();
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this._onDidChange.dispose();
  }
}
