import { setup, teardown, suite, test } from "mocha";
import { expect } from "chai";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { IndexApp } from "../../application/IndexApp";
import { Indexer } from "../../application/ports/Indexer";

suite("IndexApp", () => {
  let indexApp: IndexApp;
  let mockIndexer: sinon.SinonStubbedInstance<Indexer>;

  setup(() => {
    // Mock Indexer port
    mockIndexer = {
      build: sinon.stub().resolves({ folders: [], rootPrompts: [] }),
      rebuild: sinon.stub().resolves(),
      rebuildNow: sinon.stub().resolves(),
      get: sinon.stub().returns({ folders: [], rootPrompts: [] }),
    } as any;

    indexApp = new IndexApp(mockIndexer);
  });

  teardown(() => {
    sinon.restore();
  });

  suite("rebuild", () => {
    test("should call indexer.rebuild() when debounced is true", async () => {
      await indexApp.rebuild(true);

      expect(mockIndexer.rebuild.calledOnce).to.be.true;
      expect(mockIndexer.rebuildNow.notCalled).to.be.true;
    });

    test("should call indexer.rebuildNow() when debounced is false", async () => {
      await indexApp.rebuild(false);

      expect(mockIndexer.rebuildNow.calledOnce).to.be.true;
      expect(mockIndexer.rebuild.notCalled).to.be.true;
    });

    test("should fire onTreeChanged event after successful rebuild", async () => {
      let eventFired = false;
      const subscription = indexApp.onTreeChanged(() => {
        eventFired = true;
      });

      await indexApp.rebuild(true);

      expect(eventFired).to.be.true;
      subscription.dispose();
    });

    test("should catch and log errors but not throw", async () => {
      const consoleErrorStub = sinon.stub(console, "error");
      mockIndexer.rebuild.rejects(new Error("Rebuild failed"));

      let eventFired = false;
      const subscription = indexApp.onTreeChanged(() => {
        eventFired = true;
      });

      try {
        await indexApp.rebuild(true);
      } catch (error) {
        expect.fail("Expected rebuild to not throw an error");
      }

      expect(consoleErrorStub.calledOnce).to.be.true;
      expect(consoleErrorStub.firstCall.args[0]).to.equal(
        "Failed to rebuild index:"
      );
      expect(eventFired).to.be.false; // Should not fire event on error

      subscription.dispose();
      consoleErrorStub.restore();
    });
  });

  suite("rebuildNow", () => {
    test("should call rebuild with debounced=false", async () => {
      await indexApp.rebuildNow();

      expect(mockIndexer.rebuildNow.calledOnce).to.be.true;
    });

    test("should fire onTreeChanged event after successful rebuildNow", async () => {
      let eventFired = false;
      const subscription = indexApp.onTreeChanged(() => {
        eventFired = true;
      });

      await indexApp.rebuildNow();

      expect(eventFired).to.be.true;
      subscription.dispose();
    });
  });

  suite("Event handling", () => {
    test("should expose onTreeChanged event", () => {
      expect(typeof indexApp.onTreeChanged).to.equal("function");
    });
  });
});
