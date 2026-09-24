import test from "node:test";
import assert from "node:assert/strict";
import { droppedFiles, fileKey, relativeName } from "../src/imports.mjs";

const fileEntry = (name) => ({
  name, isFile: true,
  file: (resolve) => resolve({ name, size: 10, lastModified: 123, type: "application/pdf", arrayBuffer: async () => new ArrayBuffer(10) }),
});
function directory(name, chunks) {
  return { name, isDirectory: true, createReader: () => {
    let index = 0;
    return { readEntries: (resolve) => resolve(chunks[index++] || []) };
  } };
}
test("browser folder drop reads every directory chunk and preserves relative paths", async () => {
  const entry = directory("Folder", [
    [fileEntry("a.pdf"), fileEntry("notes.txt")],
    [directory("nested", [[fileEntry("b.PDF")]])],
  ]);
  const files = await droppedFiles({ items: [{ webkitGetAsEntry: () => entry }] });
  assert.deepEqual(files.map(relativeName), ["Folder/a.pdf", "Folder/nested/b.PDF"]);
  assert.equal((await files[0].arrayBuffer()).byteLength, 10);
});
test("ordinary drops work when directory entries are unavailable", async () => {
  const file = { name: "a.pdf", size: 10, lastModified: 123 };
  assert.deepEqual(await droppedFiles({ files: [file] }), [file]);
  assert.notEqual(fileKey(file), fileKey({ ...file, webkitRelativePath: "other/a.pdf" }));
});
test("directory enumeration failures and excessive document counts are reported", async () => {
  const broken = { name: "broken", isDirectory: true, createReader: () => ({
    readEntries: (_resolve, reject) => reject(new Error("Permission denied")),
  }) };
  await assert.rejects(droppedFiles({ items: [{ webkitGetAsEntry: () => broken }] }), /Permission denied/);
  const large = directory("Large", [Array.from({ length: 251 }, (_, i) => fileEntry(`${i}.pdf`))]);
  await assert.rejects(droppedFiles({ items: [{ webkitGetAsEntry: () => large }] }), /volumineux/);
  const exact = directory("Exact", [Array.from({ length: 250 }, (_, i) => fileEntry(`${i}.pdf`))]);
  assert.equal((await droppedFiles({ items: [{ webkitGetAsEntry: () => exact }] })).length, 250);
});
