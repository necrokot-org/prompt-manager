import { SearchService } from "../../searchService";
import { PromptFile } from "../../scanner/types";
import { SearchCriteria } from "../../searchPanelProvider";

export class SearchFilter {
  constructor(private searchService: SearchService) {}

  public async matches(
    prompt: PromptFile,
    criteria: SearchCriteria
  ): Promise<boolean> {
    return await this.searchService.matchesPrompt(prompt, criteria);
  }
}
