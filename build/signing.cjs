// electron-builder 26 configuration. Never put certificate values in logs.
module.exports = function signing(env, platform) {
  const mac = !!env.CSC_LINK?.trim();
  // Azure Artifact Signing (cloud HSM, OIDC login in CI) or a classic .pfx.
  const azureProfile = env.AZURE_SIGNING_PROFILE?.trim();
  const azure = azureProfile
    ? {
        publisherName: env.AZURE_SIGNING_PUBLISHER?.trim() || "BEO PLUS",
        endpoint:
          env.AZURE_SIGNING_ENDPOINT?.trim() ||
          "https://neu.codesigning.azure.net/",
        codeSigningAccountName:
          env.AZURE_SIGNING_ACCOUNT?.trim() || "beoplus-signing",
        certificateProfileName: azureProfile,
      }
    : null;
  const windows = !!env.WIN_CSC_LINK?.trim() || !!azure;
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
    azure,
    notarize: mac && notarize,
    force: platform === "darwin" ? mac : platform === "win32" ? windows : false,
  };
};
