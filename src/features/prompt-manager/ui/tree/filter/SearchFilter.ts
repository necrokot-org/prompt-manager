import { SearchService } from "@features/search/services/searchService";
import { PromptFile } from "@root/scanner/types";
import { SearchCriteria } from "@features/search/ui/SearchPanelProvider";

export class SearchFilter {
  constructor(private searchService: SearchService) {}

  public async matches(
    prompt: PromptFile,
    criteria: SearchCriteria
  ): Promise<boolean> {
    return await this.searchService.matchesPrompt(prompt, criteria);
  }
}
