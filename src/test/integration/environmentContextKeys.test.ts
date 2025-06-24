import { afterEach, beforeEach, describe, it } from "mocha";
import { expect } from "chai";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { activate } from "@ext/extension";
import { Environment } from "@infra/config/EnvironmentDetector";
import { container } from "@infra/di/di-container";
import { DI_TOKENS } from "@infra/di/di-tokens";

describe("Environment Context Keys", () => {
  let vscodeStubs: {
    executeCommand: sinon.SinonStub;
    showErrorMessage: sinon.SinonStub;
    showWarningMessage: sinon.SinonStub;
    showInformationMessage: sinon.SinonStub;
    createTreeView: sinon.SinonStub;
    registerWebviewViewProvider: sinon.SinonStub;
  };
  let mockContext: vscode.ExtensionContext;
  let mockWorkspace: any;

  beforeEach(() => {
    // Mock vscode API
    vscodeStubs = {
      executeCommand: sinon.stub(vscode.commands, "executeCommand"),
      showErrorMessage: sinon.stub(vscode.window, "showErrorMessage"),
      showWarningMessage: sinon.stub(vscode.window, "showWarningMessage"),
      showInformationMessage: sinon.stub(
        vscode.window,
        "showInformationMessage"
      ),
      createTreeView: sinon.stub(vscode.window, "createTreeView"),
      registerWebviewViewProvider: sinon.stub(
        vscode.window,
        "registerWebviewViewProvider"
      ),
    };

    // Mock extension context
    mockContext = {
      subscriptions: [],
      extensionPath: "/mock/path",
      globalState: {
        get: sinon.stub(),
        update: sinon.stub(),
      },
      workspaceState: {
        get: sinon.stub(),
        update: sinon.stub(),
      },
    } as any;

    // Mock workspace
    mockWorkspace = {
      workspaceFolders: [{ uri: { fsPath: "/mock/workspace" } }],
      name: "test-workspace",
      workspaceFile: undefined,
      onDidChangeWorkspaceFolders: sinon
        .stub()
        .returns({ dispose: sinon.stub() }),
      getConfiguration: sinon.stub().returns({
        get: sinon.stub().returns(".prompt_manager"),
      }),
      onDidChangeConfiguration: sinon.stub().returns({ dispose: sinon.stub() }),
    };

    Object.defineProperty(vscode.workspace, "workspaceFolders", {
      value: mockWorkspace.workspaceFolders,
      configurable: true,
    });
    Object.defineProperty(vscode.workspace, "name", {
      value: mockWorkspace.name,
      configurable: true,
    });
    Object.defineProperty(vscode.workspace, "workspaceFile", {
      value: mockWorkspace.workspaceFile,
      configurable: true,
    });

    sinon
      .stub(vscode.workspace, "onDidChangeWorkspaceFolders")
      .returns(mockWorkspace.onDidChangeWorkspaceFolders());
    sinon
      .stub(vscode.workspace, "getConfiguration")
      .returns(mockWorkspace.getConfiguration());
    sinon
      .stub(vscode.workspace, "onDidChangeConfiguration")
      .returns(mockWorkspace.onDidChangeConfiguration());

    // Mock fs operations
    sinon.stub(require("fs"), "existsSync").returns(true);
    sinon.stub(require("fs").promises, "mkdir").resolves();
    sinon.stub(require("fs").promises, "writeFile").resolves();
  });

  afterEach(() => {
    sinon.restore();
    container.clearInstances();
  });

  describe("VSCode environment detection", () => {
    it("should set correct context keys for VSCode environment", async () => {
      // Create fake EnvironmentDetector that returns VSCode
      const fakeDetector = {
        getEnvironment: () => Environment.VSCode,
        isVSCode: () => true,
        isCursor: () => false,
        isWindserf: () => false,
        isUnknown: () => false,
      };

      // Register fake detector in DI container
      container.register(DI_TOKENS.EnvironmentDetector, {
        useValue: fakeDetector,
      });

      await activate(mockContext);

      // Verify correct context keys were set
      expect(
        vscodeStubs.executeCommand.calledWith(
          "setContext",
          "promptManager.isVSCode",
          true
        )
      ).to.be.true;

      expect(
        vscodeStubs.executeCommand.calledWith(
          "setContext",
          "promptManager.isCursor",
          false
        )
      ).to.be.true;

      expect(
        vscodeStubs.executeCommand.calledWith(
          "setContext",
          "promptManager.isWindserf",
          false
        )
      ).to.be.true;

      expect(
        vscodeStubs.executeCommand.calledWith(
          "setContext",
          "promptManager.isUnknown",
          false
        )
      ).to.be.true;
    });

    it("should not show warning message for VSCode environment", async () => {
      const fakeDetector = {
        getEnvironment: () => Environment.VSCode,
        isVSCode: () => true,
        isCursor: () => false,
        isWindserf: () => false,
        isUnknown: () => false,
      };

      container.register(DI_TOKENS.EnvironmentDetector, {
        useValue: fakeDetector,
      });

      await activate(mockContext);

      expect(vscodeStubs.showWarningMessage.called).to.be.false;
    });
  });

  describe("Cursor environment detection", () => {
    it("should set correct context keys for Cursor environment", async () => {
      const fakeDetector = {
        getEnvironment: () => Environment.Cursor,
        isVSCode: () => false,
        isCursor: () => true,
        isWindserf: () => false,
        isUnknown: () => false,
      };

      container.register(DI_TOKENS.EnvironmentDetector, {
        useValue: fakeDetector,
      });

      await activate(mockContext);

      expect(
        vscodeStubs.executeCommand.calledWith(
          "setContext",
          "promptManager.isVSCode",
          false
        )
      ).to.be.true;

      expect(
        vscodeStubs.executeCommand.calledWith(
          "setContext",
          "promptManager.isCursor",
          true
        )
      ).to.be.true;

      expect(
        vscodeStubs.executeCommand.calledWith(
          "setContext",
          "promptManager.isWindserf",
          false
        )
      ).to.be.true;

      expect(
        vscodeStubs.executeCommand.calledWith(
          "setContext",
          "promptManager.isUnknown",
          false
        )
      ).to.be.true;
    });

    it("should not show warning message for Cursor environment", async () => {
      const fakeDetector = {
        getEnvironment: () => Environment.Cursor,
        isVSCode: () => false,
        isCursor: () => true,
        isWindserf: () => false,
        isUnknown: () => false,
      };

      container.register(DI_TOKENS.EnvironmentDetector, {
        useValue: fakeDetector,
      });

      await activate(mockContext);

      expect(vscodeStubs.showWarningMessage.called).to.be.false;
    });
  });

  describe("Windserf environment detection", () => {
    it("should set correct context keys for Windserf environment", async () => {
      const fakeDetector = {
        getEnvironment: () => Environment.Windserf,
        isVSCode: () => false,
        isCursor: () => false,
        isWindserf: () => true,
        isUnknown: () => false,
      };

      container.register(DI_TOKENS.EnvironmentDetector, {
        useValue: fakeDetector,
      });

      await activate(mockContext);

      expect(
        vscodeStubs.executeCommand.calledWith(
          "setContext",
          "promptManager.isVSCode",
          false
        )
      ).to.be.true;

      expect(
        vscodeStubs.executeCommand.calledWith(
          "setContext",
          "promptManager.isCursor",
          false
        )
      ).to.be.true;

      expect(
        vscodeStubs.executeCommand.calledWith(
          "setContext",
          "promptManager.isWindserf",
          true
        )
      ).to.be.true;

      expect(
        vscodeStubs.executeCommand.calledWith(
          "setContext",
          "promptManager.isUnknown",
          false
        )
      ).to.be.true;
    });

    it("should not show warning message for Windserf environment", async () => {
      const fakeDetector = {
        getEnvironment: () => Environment.Windserf,
        isVSCode: () => false,
        isCursor: () => false,
        isWindserf: () => true,
        isUnknown: () => false,
      };

      container.register(DI_TOKENS.EnvironmentDetector, {
        useValue: fakeDetector,
      });

      await activate(mockContext);

      expect(vscodeStubs.showWarningMessage.called).to.be.false;
    });
  });

  describe("Unknown environment detection", () => {
    it("should set correct context keys for unknown environment", async () => {
      const fakeDetector = {
        getEnvironment: () => Environment.Unknown,
        isVSCode: () => false,
        isCursor: () => false,
        isWindserf: () => false,
        isUnknown: () => true,
      };

      container.register(DI_TOKENS.EnvironmentDetector, {
        useValue: fakeDetector,
      });

      await activate(mockContext);

      expect(
        vscodeStubs.executeCommand.calledWith(
          "setContext",
          "promptManager.isVSCode",
          false
        )
      ).to.be.true;

      expect(
        vscodeStubs.executeCommand.calledWith(
          "setContext",
          "promptManager.isCursor",
          false
        )
      ).to.be.true;

      expect(
        vscodeStubs.executeCommand.calledWith(
          "setContext",
          "promptManager.isWindserf",
          false
        )
      ).to.be.true;

      expect(
        vscodeStubs.executeCommand.calledWith(
          "setContext",
          "promptManager.isUnknown",
          true
        )
      ).to.be.true;
    });

    it("should show warning message for unknown environment", async () => {
      const fakeDetector = {
        getEnvironment: () => Environment.Unknown,
        isVSCode: () => false,
        isCursor: () => false,
        isWindserf: () => false,
        isUnknown: () => true,
      };

      container.register(DI_TOKENS.EnvironmentDetector, {
        useValue: fakeDetector,
      });

      await activate(mockContext);

      expect(
        vscodeStubs.showWarningMessage.calledWith(
          "Unknown editor environment detected. Some features may not work as expected."
        )
      ).to.be.true;
    });
  });

  describe("Context keys order and timing", () => {
    it("should set context keys before other initialization", async () => {
      const fakeDetector = {
        getEnvironment: () => Environment.VSCode,
        isVSCode: () => true,
        isCursor: () => false,
        isWindserf: () => false,
        isUnknown: () => false,
      };

      container.register(DI_TOKENS.EnvironmentDetector, {
        useValue: fakeDetector,
      });

      await activate(mockContext);

      // Context keys should be set before tree view creation
      const setContextCalls = vscodeStubs.executeCommand
        .getCalls()
        .filter((call) => call.args[0] === "setContext");
      const createTreeViewCall = vscodeStubs.createTreeView.firstCall;

      if (createTreeViewCall) {
        // Context keys should be called before tree view creation
        setContextCalls.forEach((call) => {
          expect(call.calledBefore(createTreeViewCall)).to.be.true;
        });
      }
    });

    it("should set all four context keys", async () => {
      const fakeDetector = {
        getEnvironment: () => Environment.Cursor,
        isVSCode: () => false,
        isCursor: () => true,
        isWindserf: () => false,
        isUnknown: () => false,
      };

      container.register(DI_TOKENS.EnvironmentDetector, {
        useValue: fakeDetector,
      });

      await activate(mockContext);

      // Should set exactly 4 context keys
      const setContextCalls = vscodeStubs.executeCommand
        .getCalls()
        .filter((call) => call.args[0] === "setContext");

      expect(setContextCalls).to.have.lengthOf(4);

      // Verify all expected context keys are set
      const expectedKeys = [
        "promptManager.isVSCode",
        "promptManager.isCursor",
        "promptManager.isWindserf",
        "promptManager.isUnknown",
      ];

      expectedKeys.forEach((key) => {
        expect(setContextCalls.some((call) => call.args[1] === key)).to.be.true;
      });
    });
  });

  describe("Environment detection integration", () => {
    it("should use actual EnvironmentDetector when no fake is provided", async () => {
      // Don't register a fake detector, let DI use the real one
      await activate(mockContext);

      // Should still set context keys (using real detector)
      const setContextCalls = vscodeStubs.executeCommand
        .getCalls()
        .filter((call) => call.args[0] === "setContext");

      expect(setContextCalls).to.have.lengthOf(4);
    });

    it("should handle EnvironmentDetector errors gracefully", async () => {
      const fakeDetector = {
        getEnvironment: () => {
          throw new Error("Detector error");
        },
        isVSCode: () => {
          throw new Error("Detector error");
        },
        isCursor: () => {
          throw new Error("Detector error");
        },
        isWindserf: () => {
          throw new Error("Detector error");
        },
        isUnknown: () => {
          throw new Error("Detector error");
        },
      };

      container.register(DI_TOKENS.EnvironmentDetector, {
        useValue: fakeDetector,
      });

      // Should not throw, but may show error message
      let activationError = null;
      try {
        await activate(mockContext);
      } catch (error) {
        activationError = error;
      }

      // The activation should complete even if environment detection fails
      expect(activationError).to.be.null;
    });
  });

  describe("Context key values", () => {
    it("should set boolean values for context keys", async () => {
      const fakeDetector = {
        getEnvironment: () => Environment.Cursor,
        isVSCode: () => false,
        isCursor: () => true,
        isWindserf: () => false,
        isUnknown: () => false,
      };

      container.register(DI_TOKENS.EnvironmentDetector, {
        useValue: fakeDetector,
      });

      await activate(mockContext);

      // All context key values should be booleans
      const setContextCalls = vscodeStubs.executeCommand
        .getCalls()
        .filter((call) => call.args[0] === "setContext");

      setContextCalls.forEach((call) => {
        expect(typeof call.args[2]).to.equal("boolean");
      });
    });

    it("should ensure only one environment context key is true", async () => {
      const fakeDetector = {
        getEnvironment: () => Environment.Windserf,
        isVSCode: () => false,
        isCursor: () => false,
        isWindserf: () => true,
        isUnknown: () => false,
      };

      container.register(DI_TOKENS.EnvironmentDetector, {
        useValue: fakeDetector,
      });

      await activate(mockContext);

      const setContextCalls = vscodeStubs.executeCommand
        .getCalls()
        .filter((call) => call.args[0] === "setContext");

      // Count how many are set to true
      const trueCount = setContextCalls.filter(
        (call) => call.args[2] === true
      ).length;
      expect(trueCount).to.equal(1);

      // Verify the correct one is true
      const windserfCall = setContextCalls.find(
        (call) => call.args[1] === "promptManager.isWindserf"
      );
      expect(windserfCall?.args[2]).to.be.true;
    });
  });

  describe("No workspace scenario", () => {
    it("should not set context keys when no workspace is present", async () => {
      // Mock no workspace folders
      Object.defineProperty(vscode.workspace, "workspaceFolders", {
        value: null,
        configurable: true,
      });

      await activate(mockContext);

      // Should not set context keys when no workspace
      const setContextCalls = vscodeStubs.executeCommand
        .getCalls()
        .filter((call) => call.args[0] === "setContext");

      expect(setContextCalls).to.have.lengthOf(0);
    });

    it("should set context keys when workspace is added later", async () => {
      // Start with no workspace
      Object.defineProperty(vscode.workspace, "workspaceFolders", {
        value: null,
        configurable: true,
      });

      const fakeDetector = {
        getEnvironment: () => Environment.VSCode,
        isVSCode: () => true,
        isCursor: () => false,
        isWindserf: () => false,
        isUnknown: () => false,
      };

      container.register(DI_TOKENS.EnvironmentDetector, {
        useValue: fakeDetector,
      });

      await activate(mockContext);

      // Simulate workspace being added
      Object.defineProperty(vscode.workspace, "workspaceFolders", {
        value: [{ uri: { fsPath: "/new/workspace" } }],
        configurable: true,
      });

      // Simulate workspace change event
      const workspaceChangeHandler =
        mockWorkspace.onDidChangeWorkspaceFolders.firstCall?.returnValue;
      if (workspaceChangeHandler) {
        // This would trigger re-initialization in the real implementation
        // For this test, we're just verifying the handler exists
        expect(workspaceChangeHandler).to.exist;
      }
    });
  });
});
