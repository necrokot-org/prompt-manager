export interface PromptStore {
  rootPath(): Promise<string | undefined>;

  createPrompt(name: string, folderPath?: string): Promise<string>;
  deletePrompt(path: string): Promise<void>;

  createFolder(name: string, parentFolderPath?: string): Promise<string>;
  deleteFolder(path: string): Promise<void>;

  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;

  moveFile(sourcePath: string, targetPath: string): Promise<void>;
  moveFolder(sourcePath: string, targetPath: string): Promise<void>;

  exists(path: string): Promise<boolean>;
}
