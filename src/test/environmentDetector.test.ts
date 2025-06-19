import "reflect-metadata";
import * as assert from "assert";
import { EnvironmentDetectorImpl } from "../infrastructure/config/EnvironmentDetector";
import { Environment } from "../infrastructure/config/environment";

// Mock vscode module
const mockVSCode = {
  env: {
    appName: "Visual Studio Code",
    appHost: undefined as string | undefined,
  },
};

// Replace vscode module in require cache for testing
const Module = require("module");
const originalRequire = Module.prototype.require;
Module.prototype.require = function (...args: any[]) {
  if (args[0] === "vscode") {
    return mockVSCode;
  }
  return originalRequire.apply(this, args);
};

suite("EnvironmentDetector Test Suite", () => {
  let detector: EnvironmentDetectorImpl;

  setup(() => {
    // Reset mocks before each test
    mockVSCode.env.appName = "Visual Studio Code";
    mockVSCode.env.appHost = undefined;
  });

  suite("VS Code Environment Detection", () => {
    test("should detect VS Code when appName is 'Visual Studio Code'", () => {
      mockVSCode.env.appName = "Visual Studio Code";
      detector = new EnvironmentDetectorImpl();

      assert.strictEqual(detector.getEnvironment(), Environment.VSCode);
      assert.strictEqual(detector.isVSCode(), true);
      assert.strictEqual(detector.isCursor(), false);
      assert.strictEqual(detector.isWindserf(), false);
    });

    test("should detect VS Code when appName is 'vscode'", () => {
      mockVSCode.env.appName = "vscode";
      detector = new EnvironmentDetectorImpl();

      assert.strictEqual(detector.getEnvironment(), Environment.VSCode);
      assert.strictEqual(detector.isVSCode(), true);
      assert.strictEqual(detector.isCursor(), false);
      assert.strictEqual(detector.isWindserf(), false);
    });

    test("should detect VS Code when appName is 'Visual Studio Code'", () => {
      mockVSCode.env.appName = "Visual Studio Code";
      detector = new EnvironmentDetectorImpl();

      assert.strictEqual(detector.getEnvironment(), Environment.VSCode);
      assert.strictEqual(detector.isVSCode(), true);
      assert.strictEqual(detector.isCursor(), false);
      assert.strictEqual(detector.isWindserf(), false);
      assert.strictEqual(detector.isUnknown(), false);
    });
  });

  suite("Cursor Environment Detection", () => {
    test("should detect Cursor when appName contains 'cursor'", () => {
      mockVSCode.env.appName = "Cursor";
      detector = new EnvironmentDetectorImpl();

      assert.strictEqual(detector.getEnvironment(), Environment.Cursor);
      assert.strictEqual(detector.isVSCode(), false);
      assert.strictEqual(detector.isCursor(), true);
      assert.strictEqual(detector.isWindserf(), false);
    });

    test("should detect Cursor when appName contains 'cursor' in mixed case", () => {
      mockVSCode.env.appName = "CURSOR Editor";
      detector = new EnvironmentDetectorImpl();

      assert.strictEqual(detector.getEnvironment(), Environment.Cursor);
      assert.strictEqual(detector.isCursor(), true);
    });

    test("should detect Cursor when appHost contains 'cursor'", () => {
      mockVSCode.env.appName = "Unknown";
      mockVSCode.env.appHost = "cursor-app";
      detector = new EnvironmentDetectorImpl();

      assert.strictEqual(detector.getEnvironment(), Environment.Cursor);
      assert.strictEqual(detector.isCursor(), true);
    });
  });

  suite("Windserf Environment Detection", () => {
    test("should detect Windserf when appName contains 'windserf'", () => {
      mockVSCode.env.appName = "Windserf";
      detector = new EnvironmentDetectorImpl();

      assert.strictEqual(detector.getEnvironment(), Environment.Windserf);
      assert.strictEqual(detector.isVSCode(), false);
      assert.strictEqual(detector.isCursor(), false);
      assert.strictEqual(detector.isWindserf(), true);
    });

    test("should detect Windserf when appName contains 'windserf' in mixed case", () => {
      mockVSCode.env.appName = "WINDSERF Editor";
      detector = new EnvironmentDetectorImpl();

      assert.strictEqual(detector.getEnvironment(), Environment.Windserf);
      assert.strictEqual(detector.isWindserf(), true);
    });

    test("should detect Windserf when appHost contains 'windserf'", () => {
      mockVSCode.env.appName = "Unknown";
      mockVSCode.env.appHost = "windserf-app";
      detector = new EnvironmentDetectorImpl();

      assert.strictEqual(detector.getEnvironment(), Environment.Windserf);
      assert.strictEqual(detector.isWindserf(), true);
    });
  });

  suite("Unknown Environment and Edge Cases", () => {
    test("should return Unknown when appName is unrecognized", () => {
      mockVSCode.env.appName = "Unknown Editor";
      detector = new EnvironmentDetectorImpl();

      assert.strictEqual(detector.getEnvironment(), Environment.Unknown);
      assert.strictEqual(detector.isUnknown(), true);
      assert.strictEqual(detector.isVSCode(), false);
      assert.strictEqual(detector.isCursor(), false);
      assert.strictEqual(detector.isWindserf(), false);
    });

    test("should return Unknown when both appName and appHost are undefined", () => {
      mockVSCode.env.appName = undefined as any;
      mockVSCode.env.appHost = undefined;
      detector = new EnvironmentDetectorImpl();

      assert.strictEqual(detector.getEnvironment(), Environment.Unknown);
      assert.strictEqual(detector.isUnknown(), true);
    });

    test("should return Unknown when both appName and appHost are empty strings", () => {
      mockVSCode.env.appName = "";
      mockVSCode.env.appHost = "";
      detector = new EnvironmentDetectorImpl();

      assert.strictEqual(detector.getEnvironment(), Environment.Unknown);
      assert.strictEqual(detector.isUnknown(), true);
    });

    test("should prioritize appHost over appName when both are present", () => {
      mockVSCode.env.appName = "cursor";
      mockVSCode.env.appHost = "windserf-host";
      detector = new EnvironmentDetectorImpl();

      assert.strictEqual(detector.getEnvironment(), Environment.Windserf);
      assert.strictEqual(detector.isWindserf(), true);
    });

    test("should cache the detection result", () => {
      mockVSCode.env.appName = "Cursor";
      detector = new EnvironmentDetectorImpl();

      const firstCall = detector.getEnvironment();
      // Change the mock value
      mockVSCode.env.appName = "Windserf";
      const secondCall = detector.getEnvironment();

      // Should return the same cached result
      assert.strictEqual(firstCall, Environment.Cursor);
      assert.strictEqual(secondCall, Environment.Cursor);
    });
  });

  suite("Word Boundary Detection", () => {
    test("should detect Cursor over Windserf when both are present", () => {
      mockVSCode.env.appName = "cursor windserf";
      detector = new EnvironmentDetectorImpl();

      assert.strictEqual(detector.getEnvironment(), Environment.Cursor);
      assert.strictEqual(detector.isCursor(), true);
    });

    test("should NOT match partial strings like 'precursor'", () => {
      mockVSCode.env.appName = "precursor";
      detector = new EnvironmentDetectorImpl();

      assert.strictEqual(detector.getEnvironment(), Environment.Unknown);
      assert.strictEqual(detector.isUnknown(), true);
      assert.strictEqual(detector.isCursor(), false);
    });

    test("should NOT match partial strings like 'excursion'", () => {
      mockVSCode.env.appName = "excursion";
      detector = new EnvironmentDetectorImpl();

      assert.strictEqual(detector.getEnvironment(), Environment.Unknown);
      assert.strictEqual(detector.isUnknown(), true);
      assert.strictEqual(detector.isCursor(), false);
    });

    test("should match cursor with word boundaries", () => {
      mockVSCode.env.appName = "my-cursor-editor";
      detector = new EnvironmentDetectorImpl();

      assert.strictEqual(detector.getEnvironment(), Environment.Cursor);
      assert.strictEqual(detector.isCursor(), true);
    });

    test("should match VS Code variants with spaces", () => {
      mockVSCode.env.appName = "Microsoft Visual Studio Code";
      detector = new EnvironmentDetectorImpl();

      assert.strictEqual(detector.getEnvironment(), Environment.VSCode);
      assert.strictEqual(detector.isVSCode(), true);
    });
  });

  suite("Boolean Helper Methods", () => {
    test("should return consistent boolean values for each environment", () => {
      // Test VS Code
      mockVSCode.env.appName = "Visual Studio Code";
      detector = new EnvironmentDetectorImpl();
      assert.strictEqual(detector.isVSCode(), true);
      assert.strictEqual(detector.isCursor(), false);
      assert.strictEqual(detector.isWindserf(), false);
      assert.strictEqual(detector.isUnknown(), false);

      // Test Cursor
      mockVSCode.env.appName = "Cursor";
      detector = new EnvironmentDetectorImpl();
      assert.strictEqual(detector.isVSCode(), false);
      assert.strictEqual(detector.isCursor(), true);
      assert.strictEqual(detector.isWindserf(), false);
      assert.strictEqual(detector.isUnknown(), false);

      // Test Windserf
      mockVSCode.env.appName = "Windserf";
      detector = new EnvironmentDetectorImpl();
      assert.strictEqual(detector.isVSCode(), false);
      assert.strictEqual(detector.isCursor(), false);
      assert.strictEqual(detector.isWindserf(), true);
      assert.strictEqual(detector.isUnknown(), false);

      // Test Unknown
      mockVSCode.env.appName = "Unrecognized Editor";
      detector = new EnvironmentDetectorImpl();
      assert.strictEqual(detector.isVSCode(), false);
      assert.strictEqual(detector.isCursor(), false);
      assert.strictEqual(detector.isWindserf(), false);
      assert.strictEqual(detector.isUnknown(), true);
    });
  });
});
