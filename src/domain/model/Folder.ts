import { Prompt } from "./Prompt";

export interface Folder {
  name: string;
  path: string;
  prompts: Prompt[];
}
