import "reflect-metadata";
import * as assert from "assert";
import {
  EnvironmentDetector,
  Environment,
  VSCodeEnv,
} from "../infrastructure/config/EnvironmentDetector";

suite("EnvironmentDetector Test Suite", () => {
  let detector: EnvironmentDetector;

  setup(() => {
    // No setup needed for direct constructor testing
  });

  suite("VS Code Environment Detection", () => {
    test("should detect VS Code when appName is 'Visual Studio Code'", () => {
      const mockEnv: VSCodeEnv = { appName: "Visual Studio Code" };
      detector = new EnvironmentDetector(mockEnv);

      assert.strictEqual(detector.getEnvironment(), Environment.VSCode);
      assert.strictEqual(detector.isVSCode(), true);
      assert.strictEqual(detector.isCursor(), false);
      assert.strictEqual(detector.isWindserf(), false);
    });

    test("should detect VS Code when appName is 'vscode'", () => {
      const mockEnv: VSCodeEnv = { appName: "vscode" };
      detector = new EnvironmentDetector(mockEnv);

      assert.strictEqual(detector.getEnvironment(), Environment.VSCode);
      assert.strictEqual(detector.isVSCode(), true);
      assert.strictEqual(detector.isCursor(), false);
      assert.strictEqual(detector.isWindserf(), false);
    });

    test("should detect VS Code when appName is 'Visual Studio Code'", () => {
      const mockEnv: VSCodeEnv = { appName: "Visual Studio Code" };
      detector = new EnvironmentDetector(mockEnv);

      assert.strictEqual(detector.getEnvironment(), Environment.VSCode);
      assert.strictEqual(detector.isVSCode(), true);
      assert.strictEqual(detector.isCursor(), false);
      assert.strictEqual(detector.isWindserf(), false);
      assert.strictEqual(detector.isUnknown(), false);
    });
  });

  suite("Cursor Environment Detection", () => {
    test("should detect Cursor when appName contains 'cursor'", () => {
      const mockEnv: VSCodeEnv = { appName: "Cursor" };
      detector = new EnvironmentDetector(mockEnv);

      assert.strictEqual(detector.getEnvironment(), Environment.Cursor);
      assert.strictEqual(detector.isVSCode(), false);
      assert.strictEqual(detector.isCursor(), true);
      assert.strictEqual(detector.isWindserf(), false);
    });

    test("should detect Cursor when appName contains 'cursor' in mixed case", () => {
      const mockEnv: VSCodeEnv = { appName: "CURSOR Editor" };
      detector = new EnvironmentDetector(mockEnv);

      assert.strictEqual(detector.getEnvironment(), Environment.Cursor);
      assert.strictEqual(detector.isCursor(), true);
    });

    test("should detect Cursor when appHost contains 'cursor'", () => {
      const mockEnv: VSCodeEnv = { appName: "Unknown", appHost: "cursor-app" };
      detector = new EnvironmentDetector(mockEnv);

      assert.strictEqual(detector.getEnvironment(), Environment.Cursor);
      assert.strictEqual(detector.isCursor(), true);
    });
  });

  suite("Windserf Environment Detection", () => {
    test("should detect Windserf when appName contains 'windserf'", () => {
      const mockEnv: VSCodeEnv = { appName: "Windserf" };
      detector = new EnvironmentDetector(mockEnv);

      assert.strictEqual(detector.getEnvironment(), Environment.Windserf);
      assert.strictEqual(detector.isVSCode(), false);
      assert.strictEqual(detector.isCursor(), false);
      assert.strictEqual(detector.isWindserf(), true);
    });

    test("should detect Windserf when appName contains 'windserf' in mixed case", () => {
      const mockEnv: VSCodeEnv = { appName: "WINDSERF Editor" };
      detector = new EnvironmentDetector(mockEnv);

      assert.strictEqual(detector.getEnvironment(), Environment.Windserf);
      assert.strictEqual(detector.isWindserf(), true);
    });

    test("should detect Windserf when appHost contains 'windserf'", () => {
      const mockEnv: VSCodeEnv = {
        appName: "Unknown",
        appHost: "windserf-app",
      };
      detector = new EnvironmentDetector(mockEnv);

      assert.strictEqual(detector.getEnvironment(), Environment.Windserf);
      assert.strictEqual(detector.isWindserf(), true);
    });
  });

  suite("Unknown Environment and Edge Cases", () => {
    test("should return Unknown when appName is unrecognized", () => {
      const mockEnv: VSCodeEnv = { appName: "Unknown Editor" };
      detector = new EnvironmentDetector(mockEnv);

      assert.strictEqual(detector.getEnvironment(), Environment.Unknown);
      assert.strictEqual(detector.isUnknown(), true);
      assert.strictEqual(detector.isVSCode(), false);
      assert.strictEqual(detector.isCursor(), false);
      assert.strictEqual(detector.isWindserf(), false);
    });

    test("should return Unknown when both appName and appHost are undefined", () => {
      const mockEnv: VSCodeEnv = { appName: undefined, appHost: undefined };
      detector = new EnvironmentDetector(mockEnv);

      assert.strictEqual(detector.getEnvironment(), Environment.Unknown);
      assert.strictEqual(detector.isUnknown(), true);
    });

    test("should return Unknown when both appName and appHost are empty strings", () => {
      const mockEnv: VSCodeEnv = { appName: "", appHost: "" };
      detector = new EnvironmentDetector(mockEnv);

      assert.strictEqual(detector.getEnvironment(), Environment.Unknown);
      assert.strictEqual(detector.isUnknown(), true);
    });

    test("should prioritize appHost over appName when both are present", () => {
      const mockEnv: VSCodeEnv = {
        appName: "cursor",
        appHost: "windserf-host",
      };
      detector = new EnvironmentDetector(mockEnv);

      assert.strictEqual(detector.getEnvironment(), Environment.Windserf);
      assert.strictEqual(detector.isWindserf(), true);
    });

    test("should cache the detection result", () => {
      const mockEnv: VSCodeEnv = { appName: "Cursor" };
      detector = new EnvironmentDetector(mockEnv);

      const firstCall = detector.getEnvironment();
      // The detector should cache the result, so changing constructor params won't affect this instance
      const secondCall = detector.getEnvironment();

      // Should return the same cached result
      assert.strictEqual(firstCall, Environment.Cursor);
      assert.strictEqual(secondCall, Environment.Cursor);
    });
  });

  suite("Word Boundary Detection", () => {
    test("should detect Cursor over Windserf when both are present", () => {
      const mockEnv: VSCodeEnv = { appName: "cursor windserf" };
      detector = new EnvironmentDetector(mockEnv);

      assert.strictEqual(detector.getEnvironment(), Environment.Cursor);
      assert.strictEqual(detector.isCursor(), true);
    });

    test("should NOT match partial strings like 'precursor'", () => {
      const mockEnv: VSCodeEnv = { appName: "precursor" };
      detector = new EnvironmentDetector(mockEnv);

      assert.strictEqual(detector.getEnvironment(), Environment.Unknown);
      assert.strictEqual(detector.isUnknown(), true);
      assert.strictEqual(detector.isCursor(), false);
    });

    test("should NOT match partial strings like 'excursion'", () => {
      const mockEnv: VSCodeEnv = { appName: "excursion" };
      detector = new EnvironmentDetector(mockEnv);

      assert.strictEqual(detector.getEnvironment(), Environment.Unknown);
      assert.strictEqual(detector.isUnknown(), true);
      assert.strictEqual(detector.isCursor(), false);
    });

    test("should match cursor with word boundaries", () => {
      const mockEnv: VSCodeEnv = { appName: "my-cursor-editor" };
      detector = new EnvironmentDetector(mockEnv);

      assert.strictEqual(detector.getEnvironment(), Environment.Cursor);
      assert.strictEqual(detector.isCursor(), true);
    });

    test("should match VS Code variants with spaces", () => {
      const mockEnv: VSCodeEnv = { appName: "Microsoft Visual Studio Code" };
      detector = new EnvironmentDetector(mockEnv);

      assert.strictEqual(detector.getEnvironment(), Environment.VSCode);
      assert.strictEqual(detector.isVSCode(), true);
    });
  });

  suite("Boolean Helper Methods", () => {
    test("should return consistent boolean values for each environment", () => {
      // Test VS Code
      let mockEnv: VSCodeEnv = { appName: "Visual Studio Code" };
      detector = new EnvironmentDetector(mockEnv);
      assert.strictEqual(detector.isVSCode(), true);
      assert.strictEqual(detector.isCursor(), false);
      assert.strictEqual(detector.isWindserf(), false);
      assert.strictEqual(detector.isUnknown(), false);

      // Test Cursor
      mockEnv = { appName: "Cursor" };
      detector = new EnvironmentDetector(mockEnv);
      assert.strictEqual(detector.isVSCode(), false);
      assert.strictEqual(detector.isCursor(), true);
      assert.strictEqual(detector.isWindserf(), false);
      assert.strictEqual(detector.isUnknown(), false);

      // Test Windserf
      mockEnv = { appName: "Windserf" };
      detector = new EnvironmentDetector(mockEnv);
      assert.strictEqual(detector.isVSCode(), false);
      assert.strictEqual(detector.isCursor(), false);
      assert.strictEqual(detector.isWindserf(), true);
      assert.strictEqual(detector.isUnknown(), false);

      // Test Unknown
      mockEnv = { appName: "Unrecognized Editor" };
      detector = new EnvironmentDetector(mockEnv);
      assert.strictEqual(detector.isVSCode(), false);
      assert.strictEqual(detector.isCursor(), false);
      assert.strictEqual(detector.isWindserf(), false);
      assert.strictEqual(detector.isUnknown(), true);
    });
  });
});
