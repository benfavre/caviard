import { mkdir, writeFile, unlink, copyFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const desktopId = "com.benfavre.caviard.desktop";
const escapeValue = (value) => value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t");

export function desktopEntry(executable, icon) {
  if (!path.isAbsolute(executable) || /[\x00-\x1f]/.test(executable))
    throw new Error("Invalid executable path");
  const quoted = '"' + executable.replace(/%/g, "%%").replace(/[\\"`$]/g, "\\$&") + '"';
  return `[Desktop Entry]\nType=Application\nName=Inklura PDF\nComment=Caviarder des PDF sur votre appareil\nExec=${escapeValue(quoted)} -- %F\nIcon=${escapeValue(icon)}\nTerminal=false\nCategories=Office;\nMimeType=application/pdf;inode/directory;\n`;
}

export async function installDesktopEntry({ dataHome, executable, icon }) {
  const applications = path.join(dataHome, "applications");
  const iconPath = path.join(dataHome, "icons", "hicolor", "256x256", "apps", "com.benfavre.caviard.png");
  const entry = desktopEntry(executable, iconPath);
  await mkdir(applications, { recursive: true });
  await mkdir(path.dirname(iconPath), { recursive: true });
  await copyFile(icon, iconPath);
  await writeFile(path.join(applications, desktopId), entry, { mode: 0o644 });
  await run("update-desktop-database", [applications]).catch(() => {});
}

export async function removeDesktopEntry(dataHome) {
  const applications = path.join(dataHome, "applications");
  await unlink(path.join(applications, desktopId)).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
  await unlink(path.join(dataHome, "icons", "hicolor", "256x256", "apps", "com.benfavre.caviard.png"))
    .catch((error) => { if (error.code !== "ENOENT") throw error; });
  await run("update-desktop-database", [applications]).catch(() => {});
}
