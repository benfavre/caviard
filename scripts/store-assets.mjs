import { createCanvas, loadImage } from "@napi-rs/canvas";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
// Use the existing product icon, not electron-builder's sample Store tiles.
const icon = await loadImage(fileURLToPath(new URL("../build/icon.png", import.meta.url)));
const root = new URL("../build/appx/", import.meta.url);
await mkdir(root, { recursive: true });
for (const [name, width, height] of [
  ["StoreLogo.png", 50, 50], ["Square44x44Logo.png", 44, 44],
  ["Square150x150Logo.png", 150, 150], ["Wide310x150Logo.png", 310, 150],
]) {
  const canvas = createCanvas(width, height);
  const size = Math.min(width, height);
  canvas.getContext("2d").drawImage(icon, (width - size) / 2, (height - size) / 2, size, size);
  await writeFile(new URL(name, root), canvas.toBuffer("image/png"));
}
