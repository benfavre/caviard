module.exports = {
  appId: "com.benfavre.caviard",
  productName: "Caviard",
  executableName: "caviard",
  directories: { output: "release", buildResources: "build" },
  files: ["dist/**/*", "electron/**/*", "package.json", "!**/*.map"],
  asar: true,
  npmRebuild: false,
  extraMetadata: { macAutoUpdates: !!process.env.CSC_LINK },
  artifactName: "Caviard-${version}-${os}-${arch}.${ext}",
  publish: [
    {
      provider: "github",
      owner: "benfavre",
      repo: "caviard",
      releaseType: "draft",
    },
  ],
  electronUpdaterCompatibility: ">=2.16",
  linux: { target: ["AppImage"], category: "Office", icon: "build/icon.png" },
  win: { target: ["nsis"], icon: "build/icon.png" },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    deleteAppDataOnUninstall: false,
  },
  mac: {
    target: ["dmg", "zip"],
    category: "public.app-category.productivity",
    icon: "build/icon.png",
    identity: process.env.CSC_LINK ? undefined : "-",
    notarize: !!(
      process.env.APPLE_ID &&
      process.env.APPLE_APP_SPECIFIC_PASSWORD &&
      process.env.APPLE_TEAM_ID
    ),
    hardenedRuntime: !!process.env.CSC_LINK,
    entitlements: "build/entitlements.mac.plist",
    entitlementsInherit: "build/entitlements.mac.plist",
  },
};
