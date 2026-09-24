// electron-builder 26 configuration. Never put certificate values in logs.
module.exports = function signing(env, platform) {
  const mac = !!env.CSC_LINK?.trim();
  const windows = !!env.WIN_CSC_LINK?.trim();
  const notarize = [
    "APPLE_ID",
    "APPLE_APP_SPECIFIC_PASSWORD",
    "APPLE_TEAM_ID",
  ].every((key) => !!env[key]?.trim());
  if (platform === "darwin" && mac && !notarize)
    throw new Error(
      "Signed macOS releases require APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD and APPLE_TEAM_ID for notarization.",
    );
  if (
    env.INKLURA_REQUIRE_SIGNING === "true" &&
    ((platform === "darwin" && !mac) || (platform === "win32" && !windows))
  )
    throw new Error(
      "This release requires signing credentials for the target platform.",
    );
  return {
    mac,
    windows,
    notarize: mac && notarize,
    force: platform === "darwin" ? mac : platform === "win32" ? windows : false,
  };
};
