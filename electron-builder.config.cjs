// GitHub exposes absent optional secrets as empty strings. The builder treats
// an empty certificate link as a path, so omit it entirely when unconfigured.
for (const name of ["CSC_LINK", "WIN_CSC_LINK"]) {
  if (!process.env[name]?.trim()) delete process.env[name];
}

const signing = require("./build/signing.cjs")(process.env, process.platform);
module.exports = {
  forceCodeSigning: signing.force,
  appId: "com.benfavre.caviard",
  productName: "Inklura PDF",
  executableName: "caviard",
  directories: { output: "release", buildResources: "build" },
  files: [
    "dist/**/*",
    "electron/**/*",
    "package.json",
    "THIRD_PARTY_AI.md",
    "AI.md",
    "!**/*.map",
  ],
  asar: true,
  npmRebuild: false,
  extraMetadata: {
    macAutoUpdates: signing.mac && signing.notarize,
    // Account rollout is explicit. Existing released installers remain evaluation builds.
    ...(process.env.INKLURA_PDF_ACCOUNT_API ? { accountApi: process.env.INKLURA_PDF_ACCOUNT_API } : {}),
  },
  artifactName: "Inklura-PDF-${version}-${os}-${arch}.${ext}",
  publish: [
    {
      provider: "github",
      owner: "benfavre",
      repo: "caviard",
      releaseType: "draft",
    },
  ],
  electronUpdaterCompatibility: ">=2.16",
  linux: {
    target: ["AppImage"], category: "Office", icon: "build/icon.png",
    mimeTypes: ["application/pdf", "inode/directory"],
    executableArgs: ["--", "%F"],
  },
  win: { target: ["nsis"], icon: "build/icon.png", executableName: "Inklura PDF" },
  nsis: {
    include: "build/installer.nsh",
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    deleteAppDataOnUninstall: false,
  },
  mac: {
    fileAssociations: [{ ext: "pdf", name: "PDF", role: "Editor", rank: "Alternate" }],
    executableName: "Inklura PDF",
    target: ["dmg", "zip"],
    category: "public.app-category.productivity",
    icon: "build/icon.png",
    identity: signing.mac ? undefined : "-",
    notarize: signing.notarize,
    hardenedRuntime: signing.mac,
    entitlements: "build/entitlements.mac.plist",
    entitlementsInherit: "build/entitlements.mac.plist",
  },
};
