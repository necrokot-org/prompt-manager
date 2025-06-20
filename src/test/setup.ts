import 'reflect-metadata';
import { register } from 'tsconfig-paths';
import { resolve } from 'path';
import { readFileSync } from 'fs';

// Read tsconfig.json to get path mappings dynamically
// When compiled, this setup.js is in out/test/test/, so we need to go up 3 levels
const tsconfigPath = resolve(__dirname, '../../../tsconfig.json');
const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf8'));

// Register path mappings from tsconfig for runtime resolution
register({
  baseUrl: resolve(__dirname, '../'),
  paths: tsconfig.compilerOptions.paths
}); 