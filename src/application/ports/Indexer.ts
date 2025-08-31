import { PromptStructure } from "../../domain/model/PromptStructure";

export interface Indexer {
  build(): Promise<PromptStructure>;
  rebuild(): Promise<PromptStructure>; // debounced
  rebuildNow(): Promise<PromptStructure>; // immediate
  get(): PromptStructure | null;
}
