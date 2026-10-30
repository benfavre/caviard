// Render the existing vector identity at Apple's required 512pt @2x size.
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { readFile, writeFile } from 'node:fs/promises';
const svg = (await readFile(new URL('../public/inklura-icon.svg', import.meta.url), 'utf8'))
  .replace('width="128" height="128"', 'width="1024" height="1024"');
const image = await loadImage(Buffer.from(svg));
const canvas = createCanvas(1024, 1024);
canvas.getContext('2d').drawImage(image, 0, 0, 1024, 1024);
await writeFile(new URL('../build/icon-mas.png', import.meta.url), canvas.toBuffer('image/png'));
