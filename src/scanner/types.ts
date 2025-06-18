export interface PromptFile {
  name: string;
  title: string;
  path: string;
  description?: string;
  tags: string[];
  fileSize: number;
  isDirectory: boolean;
}

export interface PromptFolder {
  name: string;
  path: string;
  prompts: PromptFile[];
}

export interface PromptStructure {
  folders: PromptFolder[];
  rootPrompts: PromptFile[];
}

export interface ScanOptions {
  includeHidden?: boolean;
  maxDepth?: number;
  fileExtensions?: string[];
  excludePatterns?: string[];
}
