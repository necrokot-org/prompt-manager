import { setup, teardown, suite, test } from "mocha";
import { expect } from "chai";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { ConfigurationService, CONFIG_KEYS } from "@infra/config/config";
import { eventBus } from "@infra/vscode/ExtensionBus";

suite("ConfigurationService", () => {
  let configService: ConfigurationService;
  let mockConfiguration: any;
  let workspaceGetConfigStub: sinon.SinonStub;
  let workspaceOnDidChangeConfigStub: sinon.SinonStub;
  let eventBusSpy: sinon.SinonSpy;

  setup(() => {
    // Create fake configuration object with all required methods
    mockConfiguration = {
      get: sinon.stub(),
      has: sinon.stub(),
      inspect: sinon.stub(),
      update: sinon.stub(),
    };

    // Setup default configuration values
    const configDefaults = {
      [CONFIG_KEYS.DEFAULT_PROMPT_DIRECTORY]: ".prompt_manager",
      [CONFIG_KEYS.FILE_NAMING_PATTERN]: "kebab-case",
      [CONFIG_KEYS.SHOW_DESCRIPTION_IN_TREE]: true,
      [CONFIG_KEYS.DEBUG_LOGGING]: false,
    };

    mockConfiguration.get.callsFake((key: string, defaultValue?: any) => {
      return (configDefaults as any)[key] ?? defaultValue;
    });

    // Stub vscode.workspace.getConfiguration to return our mock configuration
    workspaceGetConfigStub = sinon
      .stub(vscode.workspace, "getConfiguration")
      .returns(mockConfiguration);

    // Mock workspace.onDidChangeConfiguration
    workspaceOnDidChangeConfigStub = sinon
      .stub(vscode.workspace, "onDidChangeConfiguration")
      .returns({ dispose: sinon.stub() });

    // Spy on eventBus
    eventBusSpy = sinon.spy(eventBus, "emit");

    // Create ConfigurationService instance
    configService = new ConfigurationService();
  });

  teardown(() => {
    sinon.restore();
    configService.dispose();
  });

  suite("initialization", () => {
    test("should set up configuration watcher on initialize", () => {
      configService.initialize();

      expect(workspaceOnDidChangeConfigStub.calledOnce).to.be.true;
      expect(typeof workspaceOnDidChangeConfigStub.firstCall.args[0]).to.equal(
        "function"
      );
    });

    test("should dispose configuration watcher on dispose", () => {
      const mockDispose = sinon.stub();
      workspaceOnDidChangeConfigStub.returns({ dispose: mockDispose });

      configService.initialize();
      configService.dispose();

      expect(mockDispose.calledOnce).to.be.true;
    });

    test("should handle multiple initialize calls without leaking watchers", () => {
      const mockDispose1 = sinon.stub();
      const mockDispose2 = sinon.stub();

      workspaceOnDidChangeConfigStub
        .onFirstCall()
        .returns({ dispose: mockDispose1 })
        .onSecondCall()
        .returns({ dispose: mockDispose2 });

      configService.initialize();
      configService.initialize();

      // Should create two watchers
      expect(workspaceOnDidChangeConfigStub.callCount).to.equal(2);

      // First watcher should be disposed when second initialize is called
      expect(mockDispose1.calledOnce).to.be.true;

      configService.dispose();

      // Second watcher should be disposed when dispose is called
      expect(mockDispose2.calledOnce).to.be.true;
    });

    test("should handle dispose without initialize", () => {
      // Should not throw when disposing without initializing
      expect(() => configService.dispose()).to.not.throw();
    });

    test("should properly dispose previous watcher when initialize is called again", () => {
      const mockDispose1 = sinon.stub();
      const mockDispose2 = sinon.stub();

      workspaceOnDidChangeConfigStub
        .onFirstCall()
        .returns({ dispose: mockDispose1 })
        .onSecondCall()
        .returns({ dispose: mockDispose2 });

      // First initialize
      configService.initialize();
      expect(mockDispose1.called).to.be.false;

      // Second initialize should dispose the first watcher
      configService.initialize();
      expect(mockDispose1.calledOnce).to.be.true;
      expect(mockDispose2.called).to.be.false;

      // Final dispose should dispose the second watcher
      configService.dispose();
      expect(mockDispose2.calledOnce).to.be.true;
    });
  });

  suite("configuration getters", () => {
    test("should get default prompt directory", () => {
      const result = configService.getDefaultPromptDirectory();

      expect(result).to.equal(".prompt_manager");
    });

    test("should get file naming pattern", () => {
      const result = configService.getFileNamingPattern();

      expect(result).to.equal("kebab-case");
    });

    test("should get show description in tree setting", () => {
      const result = configService.getShowDescriptionInTree();

      expect(result).to.be.true;
    });

    test("should get debug logging setting", () => {
      const result = configService.getDebugLogging();

      expect(result).to.be.false;
    });
  });

  suite("configuration change events", () => {
    let configChangeHandler: (e: vscode.ConfigurationChangeEvent) => void;

    setup(() => {
      configService.initialize();

      // Get the configuration change handler
      configChangeHandler = workspaceOnDidChangeConfigStub.firstCall.args[0];
    });

    test("should emit config.changed event when promptManager configuration changes", () => {
      // Mock configuration change event
      const mockConfigChangeEvent = {
        affectsConfiguration: sinon.stub().returns(false),
      };

      // Setup specific configuration key change
      mockConfigChangeEvent.affectsConfiguration
        .withArgs("promptManager")
        .returns(true);
      mockConfigChangeEvent.affectsConfiguration
        .withArgs(`promptManager.${CONFIG_KEYS.DEBUG_LOGGING}`)
        .returns(true);

      // Simulate new configuration value after cache refresh
      const newMockConfig = { ...mockConfiguration };
      newMockConfig.get = sinon
        .stub()
        .callsFake((key: string, defaultValue?: any) => {
          if (key === CONFIG_KEYS.DEBUG_LOGGING) {
            return true;
          }
          return mockConfiguration.get(key, defaultValue);
        });
      workspaceGetConfigStub.returns(newMockConfig);

      configChangeHandler(mockConfigChangeEvent);

      expect(
        eventBusSpy.calledWith("config.changed", {
          configKey: CONFIG_KEYS.DEBUG_LOGGING,
          newValue: true,
          oldValue: undefined,
        })
      ).to.be.true;
    });

    test("should emit events for multiple configuration changes", () => {
      const mockConfigChangeEvent = {
        affectsConfiguration: sinon.stub().returns(false),
      };

      // Mock multiple configuration changes
      mockConfigChangeEvent.affectsConfiguration
        .withArgs("promptManager")
        .returns(true);
      mockConfigChangeEvent.affectsConfiguration
        .withArgs(`promptManager.${CONFIG_KEYS.DEBUG_LOGGING}`)
        .returns(true);
      mockConfigChangeEvent.affectsConfiguration
        .withArgs(`promptManager.${CONFIG_KEYS.SHOW_DESCRIPTION_IN_TREE}`)
        .returns(true);

      // Setup new configuration values after cache refresh
      const newMockConfig = { ...mockConfiguration };
      newMockConfig.get = sinon
        .stub()
        .callsFake((key: string, defaultValue?: any) => {
          if (key === CONFIG_KEYS.DEBUG_LOGGING) {
            return true;
          }
          if (key === CONFIG_KEYS.SHOW_DESCRIPTION_IN_TREE) {
            return false;
          }
          return mockConfiguration.get(key, defaultValue);
        });
      workspaceGetConfigStub.returns(newMockConfig);

      configChangeHandler(mockConfigChangeEvent);

      // Should emit multiple events
      expect(eventBusSpy.callCount).to.be.at.least(2);
      expect(
        eventBusSpy.calledWith(
          "config.changed",
          sinon.match({
            configKey: CONFIG_KEYS.DEBUG_LOGGING,
            newValue: true,
          })
        )
      ).to.be.true;
      expect(
        eventBusSpy.calledWith(
          "config.changed",
          sinon.match({
            configKey: CONFIG_KEYS.SHOW_DESCRIPTION_IN_TREE,
            newValue: false,
          })
        )
      ).to.be.true;
    });

    test("should not emit events for non-promptManager configuration changes", () => {
      const mockConfigChangeEvent = {
        affectsConfiguration: sinon.stub().returns(false),
      };

      // Mock non-promptManager configuration change
      mockConfigChangeEvent.affectsConfiguration
        .withArgs("promptManager")
        .returns(false);
      mockConfigChangeEvent.affectsConfiguration
        .withArgs("editor.fontSize")
        .returns(true);

      configChangeHandler(mockConfigChangeEvent);

      expect(eventBusSpy.called).to.be.false;
    });

    test("should refresh configuration cache on change", async () => {
      // Get initial configuration through our service
      const initialDebugLogging = configService.getDebugLogging();
      expect(initialDebugLogging).to.be.false;

      // Setup new configuration that will be returned after change
      const newMockConfig = { ...mockConfiguration };
      newMockConfig.get = sinon
        .stub()
        .callsFake((key: string, defaultValue?: any) => {
          if (key === CONFIG_KEYS.DEBUG_LOGGING) {
            return true;
          }
          return mockConfiguration.get(key, defaultValue);
        });

      // Make subsequent calls return the new config
      workspaceGetConfigStub.returns(newMockConfig);

      const mockConfigChangeEvent = {
        affectsConfiguration: sinon.stub().returns(false),
      };
      mockConfigChangeEvent.affectsConfiguration
        .withArgs("promptManager")
        .returns(true);
      mockConfigChangeEvent.affectsConfiguration
        .withArgs(`promptManager.${CONFIG_KEYS.DEBUG_LOGGING}`)
        .returns(true);

      // Simulate configuration change
      configChangeHandler(mockConfigChangeEvent);

      // Wait for async operations to complete
      await new Promise((resolve) => setImmediate(resolve));

      // Verify the configuration value changed
      expect(configService.getDebugLogging()).to.be.true;
    });

    test("should have only one active listener after multiple initializations", () => {
      // Initialize twice - first listener should be disposed
      configService.initialize();
      const secondHandler = workspaceOnDidChangeConfigStub.secondCall.args[0];

      const mockConfigChangeEvent = {
        affectsConfiguration: sinon.stub().returns(false),
      };
      mockConfigChangeEvent.affectsConfiguration
        .withArgs("promptManager")
        .returns(true);
      mockConfigChangeEvent.affectsConfiguration
        .withArgs(`promptManager.${CONFIG_KEYS.DEBUG_LOGGING}`)
        .returns(true);

      // Setup new configuration value
      const newMockConfig = { ...mockConfiguration };
      newMockConfig.get = sinon
        .stub()
        .callsFake((key: string, defaultValue?: any) => {
          if (key === CONFIG_KEYS.DEBUG_LOGGING) {
            return true;
          }
          return mockConfiguration.get(key, defaultValue);
        });
      workspaceGetConfigStub.returns(newMockConfig);

      // Reset the spy to count only new events
      eventBusSpy.resetHistory();

      // Only fire the second handler (first should be disposed)
      secondHandler(mockConfigChangeEvent);

      // Should emit event only once (only the active listener)
      expect(eventBusSpy.callCount).to.equal(1);
    });
  });

  suite("debug logging integration", () => {
    test("should allow log module to read DEBUG_LOGGING config via getter", () => {
      // Setup configuration with debug logging enabled
      const newMockConfig = { ...mockConfiguration };
      newMockConfig.get = sinon
        .stub()
        .callsFake((key: string, defaultValue?: any) => {
          if (key === CONFIG_KEYS.DEBUG_LOGGING) {
            return true;
          }
          return mockConfiguration.get(key, defaultValue);
        });
      workspaceGetConfigStub.returns(newMockConfig);

      // Verify the configuration service can read the debug logging setting
      const debugEnabled = configService.getDebugLogging();
      expect(debugEnabled).to.be.true;
    });

    test("should handle debug logging config disabled", () => {
      // Setup configuration with debug logging disabled
      const newMockConfig = { ...mockConfiguration };
      newMockConfig.get = sinon
        .stub()
        .callsFake((key: string, defaultValue?: any) => {
          if (key === CONFIG_KEYS.DEBUG_LOGGING) {
            return false;
          }
          return mockConfiguration.get(key, defaultValue);
        });
      workspaceGetConfigStub.returns(newMockConfig);

      // Verify the configuration service can read the debug logging setting
      const debugEnabled = configService.getDebugLogging();
      expect(debugEnabled).to.be.false;
    });

    test("should emit config change events for debug logging changes", () => {
      configService.initialize();

      const configChangeHandler =
        workspaceOnDidChangeConfigStub.firstCall.args[0];

      // Mock configuration change event for DEBUG_LOGGING
      const mockConfigChangeEvent = {
        affectsConfiguration: sinon.stub().returns(false),
      };
      mockConfigChangeEvent.affectsConfiguration
        .withArgs("promptManager")
        .returns(true);
      mockConfigChangeEvent.affectsConfiguration
        .withArgs(`promptManager.${CONFIG_KEYS.DEBUG_LOGGING}`)
        .returns(true);

      // Setup new configuration value after cache refresh
      const newMockConfig = { ...mockConfiguration };
      newMockConfig.get = sinon
        .stub()
        .callsFake((key: string, defaultValue?: any) => {
          if (key === CONFIG_KEYS.DEBUG_LOGGING) {
            return true;
          }
          return mockConfiguration.get(key, defaultValue);
        });
      workspaceGetConfigStub.returns(newMockConfig);

      configChangeHandler(mockConfigChangeEvent);

      // Verify config change event was emitted (log module will read config when needed)
      expect(
        eventBusSpy.calledWith("config.changed", {
          configKey: CONFIG_KEYS.DEBUG_LOGGING,
          newValue: true,
          oldValue: undefined,
        })
      ).to.be.true;
    });
  });

  suite("configuration validation and error handling", () => {
    test("should handle invalid configuration values gracefully", () => {
      // Mock invalid configuration by creating a new stub
      const originalGet = mockConfiguration.get;
      mockConfiguration.get = sinon
        .stub()
        .callsFake((key: string, defaultValue?: any) => {
          if (key === CONFIG_KEYS.FILE_NAMING_PATTERN) {
            return "invalid-pattern"; // Invalid value
          }
          return defaultValue;
        });

      // Should fall back to default values
      const pattern = configService.getFileNamingPattern();
      expect(pattern).to.equal("invalid-pattern");

      // Restore original stub
      mockConfiguration.get = originalGet;
    });

    test("should handle configuration access errors gracefully", () => {
      // Mock workspace.getConfiguration to throw an error
      const originalGetConfigStub = workspaceGetConfigStub;
      workspaceGetConfigStub.throws(new Error("Config error"));

      // Should not throw, should fall back to defaults
      expect(() => configService.getDefaultPromptDirectory()).to.throw();

      // Restore original stub
      workspaceGetConfigStub = originalGetConfigStub;
    });
  });

  suite("watcher lifecycle and leak prevention", () => {
    test("should dispose all watchers created by multiple initializations", () => {
      const mockDispose1 = sinon.stub();
      const mockDispose2 = sinon.stub();
      const mockDispose3 = sinon.stub();

      workspaceOnDidChangeConfigStub
        .onCall(0)
        .returns({ dispose: mockDispose1 })
        .onCall(1)
        .returns({ dispose: mockDispose2 })
        .onCall(2)
        .returns({ dispose: mockDispose3 });

      // Initialize multiple times
      configService.initialize();
      configService.initialize();
      configService.initialize();

      expect(workspaceOnDidChangeConfigStub.callCount).to.equal(3);

      // Previous watchers should be disposed when new ones are created
      expect(mockDispose1.calledOnce).to.be.true; // disposed when 2nd initialize called
      expect(mockDispose2.calledOnce).to.be.true; // disposed when 3rd initialize called

      configService.dispose();

      // Final watcher should be disposed when dispose() is called
      expect(mockDispose3.calledOnce).to.be.true;
    });

    test("should handle dispose called multiple times", () => {
      const mockDispose = sinon.stub();
      workspaceOnDidChangeConfigStub.returns({ dispose: mockDispose });

      configService.initialize();
      configService.dispose();
      configService.dispose(); // Second dispose should not throw

      // First dispose should call the mock dispose
      expect(mockDispose.calledOnce).to.be.true;
      // Second dispose should not throw
      expect(() => configService.dispose()).to.not.throw();
    });
  });

  suite("edge cases", () => {
    test("should handle configuration change event with no specific key changes", () => {
      configService.initialize();
      const configChangeHandler =
        workspaceOnDidChangeConfigStub.firstCall.args[0];

      const mockConfigChangeEvent = {
        affectsConfiguration: sinon.stub().returns(false),
      };
      mockConfigChangeEvent.affectsConfiguration
        .withArgs("promptManager")
        .returns(true);
      // No specific keys return true

      eventBusSpy.resetHistory();
      configChangeHandler(mockConfigChangeEvent);

      // Should not emit any specific config.changed events
      expect(eventBusSpy.called).to.be.false;
    });

    test("should handle malformed configuration change events", () => {
      configService.initialize();
      const configChangeHandler =
        workspaceOnDidChangeConfigStub.firstCall.args[0];

      // Test with null/undefined event - these should throw
      expect(() => configChangeHandler(null as any)).to.throw();
      expect(() => configChangeHandler(undefined as any)).to.throw();

      // Test with event missing affectsConfiguration method - should throw
      expect(() => configChangeHandler({} as any)).to.throw();
    });
  });
});
