import { defineConfig } from '@vscode/test-cli';
import { resolve } from 'path';

export default defineConfig({
	files: 'out/test/**/*.test.js',
	mocha: {
		require: [resolve('out/test/test/setup.js')]
	}
});
