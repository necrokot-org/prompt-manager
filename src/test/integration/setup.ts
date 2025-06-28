import "reflect-metadata";
import { register } from "tsconfig-paths";
import { resolve } from "path";
import { readFileSync, existsSync } from "fs";

// Read tsconfig.json to get path mappings dynamically
// Try different possible locations for tsconfig.json
const possiblePaths = [
  resolve(__dirname, "../../../tsconfig.json"), // When compiled to out/test/
  resolve(__dirname, "../../tsconfig.json"), // When running from src/test/
  resolve(process.cwd(), "tsconfig.json"), // From project root
];

let tsconfigPath: string | undefined;
let tsconfig: any;

for (const path of possiblePaths) {
  if (existsSync(path)) {
    tsconfigPath = path;
    break;
  }
}

if (tsconfigPath) {
  tsconfig = JSON.parse(readFileSync(tsconfigPath, "utf8"));

  // Register path mappings from tsconfig for runtime resolution
  register({
    baseUrl: resolve(__dirname, "../"),
    paths: tsconfig.compilerOptions.paths,
  });
}

// Initialize any global test setup needed for VS Code Extension Host testing
console.log("Integration test setup loaded in Extension Host");
