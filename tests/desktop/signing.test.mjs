import { test } from "node:test";
import assert from "node:assert/strict";
import signing from "../../build/signing.cjs";
test("Mac automatic updates require signing and notarization together", () => {
  assert.equal(signing({}, "darwin").notarize, false);
  assert.throws(
    () => signing({ CSC_LINK: "configured" }, "darwin"),
    /notarization/,
  );
  const result = signing(
    {
      CSC_LINK: "configured",
      APPLE_ID: "configured",
      APPLE_APP_SPECIFIC_PASSWORD: "configured",
      APPLE_TEAM_ID: "configured",
    },
    "darwin",
  );
  assert.equal(result.force, true);
  assert.equal(result.notarize, true);
});
test("mandatory signing fails closed without credentials; unsigned Linux remains supported", () => {
  for (const platform of ["win32", "darwin"])
    assert.throws(
      () => signing({ INKLURA_REQUIRE_SIGNING: "true" }, platform),
      /credentials/,
    );
  assert.equal(signing({ WIN_CSC_LINK: "configured" }, "win32").force, true);
  assert.equal(
    signing({ INKLURA_REQUIRE_SIGNING: "true" }, "linux").force,
    false,
  );
});
