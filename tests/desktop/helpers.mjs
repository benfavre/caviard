// Substitute only the account boundary inside the Playwright-controlled main
// process. The shipped application has no test flag or authentication bypass.
export async function fixtureAccount(app) {
  await app.evaluate(async ({ app }) => {
    const require = process.getBuiltinModule("module").createRequire(
      app.getAppPath() + "/package.json",
    );
    const { AccountController } = require(app.getAppPath() + "/electron/account.mjs");
    AccountController.prototype.refresh = async function () {
      this.account = { accountId: "packaged-test", remaining: 20, reserved: 0 };
      this.phase = "signed-in";
      return this.publish();
    };
    AccountController.prototype.request = async function (route) {
      if (!["/v1/exports/reserve", "/v1/exports/commit", "/v1/exports/release"].includes(route))
        throw Error("Unexpected fixture request");
      return { remaining: 20 };
    };
  });
}
