import { eventBus } from "./ExtensionBus";
import * as path from "path";

/**
 * Centralized helper to publish typed filesystem events to the global `eventBus`.
 *
 * Having a single module guarantees that every event has a consistent payload
 * and makes it easier to stub / spy during unit-tests.
 */
export namespace FileSystemEventPublisher {
  // -------------------------------------------------------------------------
  // File-level events --------------------------------------------------------
  // -------------------------------------------------------------------------
  export function fileCreated(filePath: string): void {
    eventBus.emit("filesystem.file.created", {
      filePath,
      fileName: path.basename(filePath),
    });
  }

  export function fileDeleted(filePath: string): void {
    eventBus.emit("filesystem.file.deleted", {
      filePath,
      fileName: path.basename(filePath),
    });
  }

  export function fileChanged(filePath: string): void {
    eventBus.emit("filesystem.file.changed", {
      filePath,
      fileName: path.basename(filePath),
    });
  }

  // -------------------------------------------------------------------------
  // Directory-level events ---------------------------------------------------
  // -------------------------------------------------------------------------
  export function dirCreated(dirPath: string): void {
    eventBus.emit("filesystem.directory.created", {
      dirPath,
      dirName: path.basename(dirPath),
    });
  }

  export function dirDeleted(dirPath: string): void {
    eventBus.emit("filesystem.directory.deleted", {
      dirPath,
      dirName: path.basename(dirPath),
    });
  }

  /**
   * Emit a directory rename / move event.
   */
  export function dirChanged(oldPath: string, newPath: string): void {
    eventBus.emit("filesystem.directory.changed", {
      oldPath,
      newPath,
      dirName: path.basename(newPath),
    });
  }
}
