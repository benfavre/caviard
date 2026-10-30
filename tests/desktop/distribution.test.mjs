import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createUpdateController, distributionChannel } from "../../electron/distribution.mjs";

test("store installations never load or call the GitHub updater, even through IPC actions", async () => {
  for (const input of [
    { mas: true }, { windowsStore: true },
    { metadata: { distributionChannel: "mac-app-store" } },
    { metadata: { distributionChannel: "microsoft-store" } },
  ]) {
    const controller = await createUpdateController({
      channel: distributionChannel(input), enabled: true,
      loadUpdater() { assert.fail("A store build must not import electron-updater"); },
      onInstall() { assert.fail("A store build must not quit to install a GitHub update"); },
    });
    controller.start();
    assert.equal((await controller.check()).phase, "store");
    assert.equal(controller.install().reason, "store-managed");
    assert.equal(controller.startTimer, undefined);
    assert.equal(controller.interval, undefined);
    controller.dispose();
  }
});

test("native store identity overrides direct or conflicting package metadata", () => {
  assert.equal(distributionChannel({ mas: true, metadata: { distributionChannel: "direct" } }), "mac-app-store");
  assert.equal(distributionChannel({ windowsStore: true, metadata: { distributionChannel: "mac-app-store" } }), "microsoft-store");
  assert.equal(distributionChannel(), "direct");
});

test("direct downloads keep checks, automatic downloads and the unsaved-work restart guard", async () => {
  const updater = new EventEmitter();
  let checks = 0, installs = 0, dirty = true;
  updater.checkForUpdates = async () => { checks++; updater.emit("update-downloaded", { version: "2.0.0" }); };
  updater.quitAndInstall = () => installs++;
  const controller = await createUpdateController({
    channel: "direct", loadUpdater: async () => updater, canInstall: () => !dirty,
  });
  assert.equal(updater.autoDownload, true);
  assert.equal(updater.autoInstallOnAppQuit, false);
  assert.equal((await controller.check()).phase, "ready");
  assert.equal(checks, 1);
  assert.equal(controller.install().reason, "unsaved");
  assert.equal(installs, 0);
  dirty = false;
  assert.equal(controller.install().ok, true);
  assert.equal(installs, 1);
  controller.dispose();
});
