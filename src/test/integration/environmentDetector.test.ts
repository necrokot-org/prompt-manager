import "reflect-metadata";
import * as assert from "assert";
import {
  EnvironmentDetector,
  Environment,
  VSCodeEnv,
} from "@infra/config/EnvironmentDetector";

suite("EnvironmentDetector Test Suite", () => {
  let detector: EnvironmentDetector;

  setup(() => {
    // No setup needed for direct constructor testing
  });

  suite("VS Code Environment Detection", () => {
    test("should detect VS Code when appName is 'vscode'", () => {
      const mockEnv: VSCodeEnv = { appName: "vscode" };
      detector = new EnvironmentDetector(mockEnv);

      assert.strictEqual(detector.getEnvironment(), Environment.VSCode);
      assert.strictEqual(detector.isVSCode(), true);
      assert.strictEqual(detector.isCursor(), false);
      assert.strictEqual(detector.isWindsurf(), false);
    });

    test("should detect VS Code when appName is 'Visual Studio Code'", () => {
      const mockEnv: VSCodeEnv = { appName: "Visual Studio Code" };
      detector = new EnvironmentDetector(mockEnv);

      assert.strictEqual(detector.getEnvironment(), Environment.VSCode);
      assert.strictEqual(detector.isVSCode(), true);
      assert.strictEqual(detector.isCursor(), false);
      assert.strictEqual(detector.isWindsurf(), false);
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
      assert.strictEqual(detector.isWindsurf(), false);
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

  suite("Windsurf Environment Detection", () => {
    test("should detect Windsurf when appName contains 'windsurf'", () => {
      const mockEnv: VSCodeEnv = { appName: "Windsurf" };
      detector = new EnvironmentDetector(mockEnv);

      assert.strictEqual(detector.getEnvironment(), Environment.Windsurf);
      assert.strictEqual(detector.isVSCode(), false);
      assert.strictEqual(detector.isCursor(), false);
      assert.strictEqual(detector.isWindsurf(), true);
    });

    test("should detect Windsurf when appName contains 'windsurf' in mixed case", () => {
      const mockEnv: VSCodeEnv = { appName: "WINDsurf Editor" };
      detector = new EnvironmentDetector(mockEnv);

      assert.strictEqual(detector.getEnvironment(), Environment.Windsurf);
      assert.strictEqual(detector.isWindsurf(), true);
    });

    test("should detect Windsurf when appHost contains 'windsurf'", () => {
      const mockEnv: VSCodeEnv = {
        appName: "Unknown",
        appHost: "windsurf-app",
      };
      detector = new EnvironmentDetector(mockEnv);

      assert.strictEqual(detector.getEnvironment(), Environment.Windsurf);
      assert.strictEqual(detector.isWindsurf(), true);
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
      assert.strictEqual(detector.isWindsurf(), false);
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
        appHost: "windsurf-host",
      };
      detector = new EnvironmentDetector(mockEnv);

      assert.strictEqual(detector.getEnvironment(), Environment.Windsurf);
      assert.strictEqual(detector.isWindsurf(), true);
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
    test("should detect Cursor over Windsurf when both are present", () => {
      const mockEnv: VSCodeEnv = { appName: "cursor windsurf" };
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
      assert.strictEqual(detector.isWindsurf(), false);
      assert.strictEqual(detector.isUnknown(), false);

      // Test Cursor
      mockEnv = { appName: "Cursor" };
      detector = new EnvironmentDetector(mockEnv);
      assert.strictEqual(detector.isVSCode(), false);
      assert.strictEqual(detector.isCursor(), true);
      assert.strictEqual(detector.isWindsurf(), false);
      assert.strictEqual(detector.isUnknown(), false);

      // Test Windsurf
      mockEnv = { appName: "Windsurf" };
      detector = new EnvironmentDetector(mockEnv);
      assert.strictEqual(detector.isVSCode(), false);
      assert.strictEqual(detector.isCursor(), false);
      assert.strictEqual(detector.isWindsurf(), true);
      assert.strictEqual(detector.isUnknown(), false);

      // Test Unknown
      mockEnv = { appName: "Unrecognized Editor" };
      detector = new EnvironmentDetector(mockEnv);
      assert.strictEqual(detector.isVSCode(), false);
      assert.strictEqual(detector.isCursor(), false);
      assert.strictEqual(detector.isWindsurf(), false);
      assert.strictEqual(detector.isUnknown(), true);
    });
  });
});
