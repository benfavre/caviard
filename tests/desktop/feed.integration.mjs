import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import {
  mkdtemp,
  readdir,
  readFile,
  writeFile,
  rm,
  stat,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import updaterModule from "electron-updater";
import executorModule from "builder-util/out/nodeHttpExecutor.js";
import electronExecutorModule from "electron-updater/out/electronHttpExecutor.js";
const { AppImageUpdater } = updaterModule;
const { NodeHttpExecutor } = executorModule;
const artifact = path.resolve(
  "release",
  (await readdir("release")).find((name) => name.endsWith(".AppImage")) ||
    "MISSING.AppImage",
);
const size = (await stat(artifact)).size;
async function digest(file) {
  const hash = createHash("sha512");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("base64");
}
const sha512 = await digest(artifact);
test("real AppImage updater checks, downloads, validates hashes, and rejects corruption", async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), "caviard-feed-"));
  let version = "1.0.1",
    corrupt = false,
    missing = false;
  const server = createServer((req, res) => {
    if (missing) {
      res.writeHead(404).end();
      return;
    }
    if (req.url.startsWith("/latest-linux.yml")) {
      res.setHeader("content-type", "text/yaml");
      res.end(
        `version: ${version}\nfiles:\n  - url: Caviard-${version}.AppImage\n    sha512: ${sha512}\n    size: ${size}\npath: Caviard-${version}.AppImage\nsha512: ${sha512}\nreleaseDate: '2026-09-23T12:00:00.000Z'\n`,
      );
      return;
    }
    if (corrupt) {
      res.end("corrupted download");
      return;
    }
    res.setHeader("content-length", size);
    createReadStream(artifact).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const previous = process.env.APPIMAGE;
  process.env.APPIMAGE = path.join(temporary, "current.AppImage");
  await writeFile(process.env.APPIMAGE, "isolated test placeholder");
  async function make(name) {
    const config = path.join(temporary, `${name}.yml`);
    await writeFile(config, `updaterCacheDirName: ${name}\n`);
    const app = {
      version: "1.0.0",
      name: "Caviard test",
      isPackaged: true,
      appUpdateConfigPath: config,
      userDataPath: temporary,
      baseCachePath: temporary,
      whenReady: async () => {},
      onQuit: () => {},
      quit: () => {
        throw Error("This test must never quit or install");
      },
      relaunch: () => {
        throw Error("This test must never launch an installer");
      },
    };
    const updater = new AppImageUpdater(null, app);
    updater.httpExecutor = new NodeHttpExecutor();
    updater.httpExecutor.download =
      electronExecutorModule.ElectronHttpExecutor.prototype.download;
    updater.setFeedURL({
      provider: "generic",
      url: `http://127.0.0.1:${server.address().port}`,
    });
    updater.logger = null;
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = false;
    updater.disableDifferentialDownload = true;
    updater.on("error", () => {});
    return updater;
  }
  try {
    const good = await make("good");
    const checked = await good.checkForUpdates();
    assert.equal(checked.updateInfo.version, "1.0.1");
    const files = await good.downloadUpdate();
    assert.equal(files.length, 1);
    assert.equal(await digest(files[0]), sha512);
    version = "1.0.0";
    const current = await make("current");
    let noUpdate = false;
    current.on("update-not-available", () => {
      noUpdate = true;
    });
    await current.checkForUpdates();
    assert.ok(noUpdate);
    version = "1.0.2";
    corrupt = true;
    const bad = await make("bad");
    await bad.checkForUpdates();
    await assert.rejects(bad.downloadUpdate(), /checksum|sha512/i);
    missing = true;
    const absent = await make("missing");
    await assert.rejects(absent.checkForUpdates(), /404|not found/i);
    assert.equal(
      await readFile(process.env.APPIMAGE, "utf8"),
      "isolated test placeholder",
    );
  } finally {
    if (previous === undefined) delete process.env.APPIMAGE;
    else process.env.APPIMAGE = previous;
    await new Promise((resolve) => server.close(resolve));
    await rm(temporary, { recursive: true, force: true });
  }
});
