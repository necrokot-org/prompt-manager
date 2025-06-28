const { defineConfig } = require("@vscode/test-cli");

module.exports = defineConfig([
  {
    label: "default",
    // Run all integration tests
    files: "out/test/test/integration/**/*.test.js",
    // open the workspace under test; can be tmp dir too
    workspaceFolder: "./__test-workspace__",
    version: "stable",
    mocha: {
      ui: "tdd", // Use TDD interface to support both describe/it and suite/test
      timeout: 10000,
      slow: 2000,
      reporter: "spec",
      bail: false, // Don't stop on first failure
      require: ["./out/test/test/setup.js"], // Ensure setup runs first
    },
  },
]);
