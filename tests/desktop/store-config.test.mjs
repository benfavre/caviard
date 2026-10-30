import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { applyStoreOptions, channel } from "../../build/store-options.cjs";
const require = createRequire(import.meta.url);
const { validateConfiguration } = require("app-builder-lib/out/util/config/config.js");
const base = require("../../electron-builder.config.cjs");
const microsoft = {
  INKLURA_DISTRIBUTION_CHANNEL: "microsoft-store",
  INKLURA_WINDOWS_IDENTITY_NAME: "Tests.InkluraPDF",
  INKLURA_WINDOWS_PUBLISHER: "CN=00000000-0000-0000-0000-000000000000",
  INKLURA_WINDOWS_PUBLISHER_DISPLAY_NAME: "Test publisher",
};
const apple = {
  INKLURA_DISTRIBUTION_CHANNEL: "mac-app-store",
  INKLURA_APPLE_TEAM_ID: "TESTTEAM01",
  INKLURA_MAS_PROVISIONING_PROFILE: "/private/test.provisionprofile",
};
test("store configurations satisfy the installed electron-builder schema", async () => {
  for (const env of [{}, microsoft, apple, { ...apple, INKLURA_MAS_DEVELOPMENT: "true" }])
    await validateConfiguration(applyStoreOptions(base, env), { isEnabled: false });
});
test("store packages cannot leak into the direct release feed", () => {
  for (const env of [microsoft, apple]) {
    const config = applyStoreOptions(base, env);
    assert.equal(config.publish, null);
    assert.notEqual(config.directories.output, base.directories.output);
    assert.equal(config.extraMetadata.macAutoUpdates, false);
    assert.equal(config.extraMetadata.accountApi, base.extraMetadata.accountApi);
    assert.equal(config.extraMetadata.distributionChannel, env.INKLURA_DISTRIBUTION_CHANNEL);
  }
  assert.equal(applyStoreOptions(base, {}), base);
  assert.throws(() => channel({ INKLURA_DISTRIBUTION_CHANNEL: "typo" }), /Unknown/);
});
test("Windows Store uses the reserved identity, Store signing and no updater manifests", () => {
  const config = applyStoreOptions(base, microsoft);
  assert.deepEqual(config.win.target, ["appx"]);
  assert.equal(config.appx.publisher, microsoft.INKLURA_WINDOWS_PUBLISHER);
  assert.equal(config.appx.identityName, microsoft.INKLURA_WINDOWS_IDENTITY_NAME);
  assert.equal(config.appx.electronUpdaterAware, false);
  assert.equal(config.win.azureSignOptions, undefined);
  assert.equal(config.forceCodeSigning, false);
  for (const key of Object.keys(microsoft).filter(key => key !== "INKLURA_DISTRIBUTION_CHANNEL"))
    assert.throws(() => applyStoreOptions(base, { ...microsoft, [key]: "" }), new RegExp(key));
});
test("MAS signing does not inherit Developer ID, notarization or direct entitlements", () => {
  for (const development of [false, true]) {
    const config = applyStoreOptions(base, { ...apple, INKLURA_MAS_DEVELOPMENT: String(development) });
    assert.deepEqual(config.mac.target, [development ? "mas-dev" : "mas"]);
    assert.equal(config.mac.notarize, false);
    assert.equal(config.mac.identity, undefined);
    assert.equal(config.forceCodeSigning, true);
    assert.equal(config.mas.provisioningProfile, apple.INKLURA_MAS_PROVISIONING_PROFILE);
    assert.equal(config.mas.extendInfo.ElectronTeamID, apple.INKLURA_APPLE_TEAM_ID);
    assert.equal(config.mas.entitlements, "build/entitlements.mas.plist");
    assert.equal(config.mas.type, development ? "development" : "distribution");
  }
  assert.throws(() => applyStoreOptions(base, { ...apple, INKLURA_APPLE_TEAM_ID: "" }), /TEAM_ID/);
  assert.throws(() => applyStoreOptions(base, { ...apple, INKLURA_MAS_PROVISIONING_PROFILE: "" }), /PROVISIONING_PROFILE/);
});
