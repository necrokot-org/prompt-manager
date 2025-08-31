import { readdirSync, readFileSync, statSync } from "fs";
import { join, extname } from "path";
import { describe, test } from "mocha";

/**
 * Ports conformance test ensuring presentation layer boundaries are respected
 *
 * This test verifies that presentation layer files do not directly import
 * from the infrastructure layer, maintaining proper layered architecture.
 */

describe("Ports Conformance", () => {
  const SRC_DIR = join(__dirname, "../../src");
  const PRESENTATION_DIR = join(SRC_DIR, "presentation");

  // For compiled tests, we need to look at source files
  const sourcePresentationDir = join(__dirname, "../../../src/presentation");

  // For compiled tests, look at the compiled output
  const compiledPresentationDir = join(__dirname, "../../presentation");

  /**
   * Recursively get all TypeScript files in a directory
   */
  function getTypeScriptFiles(dir: string): string[] {
    const files: string[] = [];

    function scanDirectory(currentDir: string): void {
      const items = readdirSync(currentDir);

      for (const item of items) {
        const fullPath = join(currentDir, item);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          scanDirectory(fullPath);
        } else if (extname(fullPath) === ".ts") {
          files.push(fullPath);
        }
      }
    }

    scanDirectory(dir);
    return files;
  }

  /**
   * Extract all import statements from a TypeScript file
   */
  function extractImports(filePath: string): string[] {
    const content = readFileSync(filePath, "utf8");
    const imports: string[] = [];

    // Match import statements (both ES6 and CommonJS style)
    const importRegex = /(?:import|from)\s+['"]([^'"]+)['"]/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    return imports;
  }

  /**
   * Check if an import path violates the architecture rules
   */
  function isArchitectureViolation(
    importPath: string,
    filePath: string
  ): boolean {
    // Only check files in the presentation directory
    if (!filePath.startsWith(PRESENTATION_DIR)) {
      return false;
    }

    // Allow relative imports (./, ../)
    if (importPath.startsWith(".")) {
      return false;
    }

    // Allow imports from node_modules
    if (!importPath.startsWith("@") && !importPath.includes("/")) {
      return false;
    }

    // Allow cross-cutting logging gateway from infrastructure
    if (importPath === "../../infrastructure/vscode/log") {
      return false;
    }

    // Check for direct infrastructure imports in presentation layer
    if (
      importPath.includes("/infrastructure/") ||
      importPath.includes("@infra/") ||
      importPath.startsWith("../../infrastructure")
    ) {
      return true;
    }

    return false;
  }

  test("presentation layer should not import from infrastructure", () => {
    const presentationFiles = getTypeScriptFiles(compiledPresentationDir);
    const violations: Array<{ file: string; importPath: string }> = [];

    for (const filePath of presentationFiles) {
      const imports = extractImports(filePath);

      for (const importPath of imports) {
        if (isArchitectureViolation(importPath, filePath)) {
          violations.push({
            file: filePath.replace(join(__dirname, "../../"), ""),
            importPath,
          });
        }
      }
    }

    if (violations.length > 0) {
      const violationMessages = violations
        .map((v) => `  ${v.file}: ${v.importPath}`)
        .join("\n");

      throw new Error(
        `Architecture violations found in presentation layer:\n` +
          `Presentation layer files are importing directly from infrastructure.\n` +
          `Use application ports instead.\n\n` +
          `Violations:\n${violationMessages}`
      );
    }
  });

  test("presentation layer should only import from allowed layers", () => {
    const presentationFiles = getTypeScriptFiles(compiledPresentationDir);
    const violations: Array<{
      file: string;
      importPath: string;
      reason: string;
    }> = [];

    for (const filePath of presentationFiles) {
      const imports = extractImports(filePath);

      for (const importPath of imports) {
        // Skip allowed imports
        if (
          importPath.startsWith(".") || // relative imports
          (!importPath.startsWith("@") && !importPath.includes("/")) || // node_modules
          importPath.includes("/domain/") || // domain layer
          importPath.includes("/application/") || // application layer
          importPath.startsWith("../../domain") ||
          importPath.startsWith("../../application") ||
          importPath.startsWith("vscode") || // VS Code API
          importPath === "../../infrastructure/vscode/log" || // cross-cutting logging
          importPath.includes("@features/")
        ) {
          // feature modules (if any)
          continue;
        }

        // Flag suspicious imports
        if (
          importPath.includes("/infrastructure/") ||
          importPath.includes("@infra/") ||
          importPath.startsWith("../../infrastructure")
        ) {
          violations.push({
            file: filePath.replace(join(__dirname, "../../"), ""),
            importPath,
            reason: "Direct infrastructure import",
          });
        } else if (
          !importPath.includes("/presentation/") &&
          !importPath.startsWith("../../presentation")
        ) {
          violations.push({
            file: filePath.replace(join(__dirname, "../../"), ""),
            importPath,
            reason: "Import from outside allowed layers",
          });
        }
      }
    }

    if (violations.length > 0) {
      const violationMessages = violations
        .map((v) => `  ${v.file}: ${v.importPath} (${v.reason})`)
        .join("\n");

      throw new Error(
        `Layer boundary violations in presentation layer:\n` +
          `Presentation layer should only import from:\n` +
          `  - domain/*\n` +
          `  - application/*\n` +
          `  - presentation/* (relative)\n` +
          `  - vscode API\n` +
          `  - node_modules\n\n` +
          `Violations:\n${violationMessages}`
      );
    }
  });
});
