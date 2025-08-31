import { Folder } from "./Folder";
import { Prompt } from "./Prompt";

export interface PromptStructure {
  folders: Folder[];
  rootPrompts: Prompt[];
}
