// Store identities must come from the publisher portals, never a guessed name.
const CHANNELS = ["direct", "mac-app-store", "microsoft-store"];
function channel(env) {
  const value = env.INKLURA_DISTRIBUTION_CHANNEL || "direct";
  if (!CHANNELS.includes(value)) throw new Error("Unknown INKLURA_DISTRIBUTION_CHANNEL");
  return value;
}
function required(env, key, pattern) {
  const value = env[key]?.trim();
  if (!value || (pattern && !pattern.test(value))) throw new Error(`Missing or invalid ${key}`);
  return value;
}
function applyStoreOptions(base, env) {
  const distribution = channel(env);
  if (distribution === "direct") return base;
  const common = {
    ...base,
    publish: null,
    directories: { ...base.directories, output: `release-${distribution}` },
    artifactName: `Inklura-PDF-\${version}-${distribution}-\${arch}.\${ext}`,
    extraMetadata: { ...base.extraMetadata, distributionChannel: distribution, macAutoUpdates: false },
  };
  if (distribution === "microsoft-store") {
    return {
      ...common,
      // Partner Center signs uploaded AppX packages. Azure signing remains for
      // direct NSIS downloads and is deliberately not a Store dependency.
      forceCodeSigning: false,
      win: { ...base.win, target: ["appx"], azureSignOptions: undefined,
        fileAssociations: [{ ext: "pdf", name: "PDF", role: "Editor" }] },
      appx: {
        identityName: required(env, "INKLURA_WINDOWS_IDENTITY_NAME", /^[A-Za-z0-9.-]{3,50}$/),
        publisher: required(env, "INKLURA_WINDOWS_PUBLISHER", /^CN=[^<>\r\n'&]+$/),
        publisherDisplayName: required(env, "INKLURA_WINDOWS_PUBLISHER_DISPLAY_NAME", /^[^<>&\r\n]+$/),
        applicationId: "InkluraPDF",
        displayName: "Inklura PDF",
        languages: ["fr-FR"],
        minVersion: "10.0.19041.0",
        maxVersionTested: "10.0.19041.0",
        setBuildNumber: false,
        electronUpdaterAware: false,
        addAutoLaunchExtension: false,
      },
    };
  }
  const team = required(env, "INKLURA_APPLE_TEAM_ID", /^[A-Z0-9]{10}$/);
  const profile = required(env, "INKLURA_MAS_PROVISIONING_PROFILE");
  const development = env.INKLURA_MAS_DEVELOPMENT === "true";
  const target = development ? "mas-dev" : "mas";
  const mas = {
    icon: "build/icon-mas.png",
    type: development ? "development" : "distribution",
    // MAS uses Apple Distribution + Mac Installer Distribution; Developer ID
    // and notarization are used only for the separate direct-download channel.
    identity: undefined,
    provisioningProfile: profile,
    hardenedRuntime: false,
    notarize: false,
    entitlements: "build/entitlements.mas.plist",
    entitlementsInherit: "build/entitlements.mas.inherit.plist",
    extendInfo: { ElectronTeamID: team },
  };
  return {
    ...common, forceCodeSigning: true,
    mac: { ...base.mac, ...mas, target: [target] },
    mas,
    ...(development ? { masDev: mas } : {}),
  };
}
module.exports = { channel, applyStoreOptions };
