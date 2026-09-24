import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, truncate } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DocumentImports, launchPaths, MAX_IMPORT_BYTES } from "../../electron/document-imports.mjs";
import { BatchExports } from "../../electron/batch-exports.mjs";
import { desktopEntry, installDesktopEntry, removeDesktopEntry } from "../../electron/linux-integration.mjs";

async function temporary(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "inklura-documents-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test("launch arguments preserve spaces and relative paths, excluding flags and remote URLs", () => {
  const cwd = path.resolve("work");
  assert.deepEqual(launchPaths(["electron", ".", "--flag", "A B.pdf", "dossier", "https://example.com/x.pdf"], cwd, false),
    [path.join(cwd, "A B.pdf"), path.join(cwd, "dossier")]);
  assert.deepEqual(launchPaths(["inklura", "--", "été.pdf"], cwd, true), [path.join(cwd, "été.pdf")]);
});

test("folder import is recursive, sorted, deduplicated and cannot follow symlinks", async (t) => {
  const root = await temporary(t);
  const folder = path.join(root, "Dossier été");
  await mkdir(path.join(folder, "nested"), { recursive: true });
  await writeFile(path.join(folder, "b.PDF"), "%PDF-b");
  await writeFile(path.join(folder, "a.pdf"), "%PDF-a");
  await writeFile(path.join(folder, "notes.txt"), "private");
  await writeFile(path.join(folder, "nested", "a.pdf"), "%PDF-c");
  await writeFile(path.join(folder, ".hidden.pdf"), "%PDF-hidden");
  if (process.platform !== "win32") await symlink(folder, path.join(folder, "nested", "loop"));
  let notifications = 0;
  const imports = new DocumentImports(() => notifications++);
  await Promise.all([imports.enqueue([folder]), imports.enqueue([path.join(folder, "a.pdf")])]);
  const { files, messages } = imports.take();
  assert.deepEqual(files.map((file) => file.relativePath), ["Dossier été/a.pdf", "Dossier été/b.PDF", "Dossier été/nested/a.pdf"]);
  assert.equal(notifications, 2);
  assert.ok(messages.some((message) => message.includes("ignoré")));
  assert.ok(files.every((file) => !Object.hasOwn(file, "path")));
  assert.equal((await imports.read(files[0].id)).toString(), "%PDF-a");
  await assert.rejects(imports.read(files[0].id), /expirée/);
  await assert.rejects(imports.read(path.join(folder, "notes.txt")), /expirée/);
  imports.discard(files.slice(1).map((file) => file.id));
  assert.equal(imports.files.size, 0);
});

test("changed and oversized files are refused and empty folders are explained", async (t) => {
  const root = await temporary(t);
  const imports = new DocumentImports();
  await imports.enqueue([root]);
  assert.match(imports.take().messages.join(" "), /Aucun nouveau PDF/);
  const file = path.join(root, "changed.pdf");
  await writeFile(file, "%PDF-");
  await imports.enqueue([file]);
  const selected = imports.take().files[0];
  await writeFile(file, "%PDF-changed");
  await assert.rejects(imports.read(selected.id), /changé/);
  await truncate(file, MAX_IMPORT_BYTES + 1);
  await imports.enqueue([file]);
  const result = imports.take();
  assert.equal(result.files.length, 0);
  assert.match(result.messages.join(" "), /512 Mo/);
});

test("large directories stop with an explicit limit instead of opening unlimited PDFs", async (t) => {
  const root = await temporary(t);
  await Promise.all(Array.from({ length: 251 }, (_, i) => writeFile(path.join(root, `${i}.pdf`), "%PDF-")));
  const imports = new DocumentImports();
  await imports.enqueue([root]);
  const result = imports.take();
  assert.equal(result.files.length, 250);
  assert.match(result.messages.join(" "), /limité à 250/);
});

test("batch export preserves folders, separates colliding names and never reuses a previous tree", async (t) => {
  const root = await temporary(t);
  const batches = new BatchExports();
  const documents = [
    { id: "a", name: "invoice.pdf", relativePath: "Client A/invoice.pdf" },
    { id: "b", name: "invoice.pdf", relativePath: "Client A/invoice.pdf" },
    { id: "c", name: "invoice.pdf", relativePath: "Client B/invoice.pdf" },
  ];
  const first = await batches.begin(root, documents);
  const destinations = await Promise.all(documents.map((doc) => batches.destination(first.id, doc.id)));
  assert.equal(new Set(destinations).size, 3);
  assert.ok(destinations[0].endsWith(path.join("Client A", "invoice-caviarde.pdf")));
  assert.ok(destinations[1].endsWith("invoice-caviarde-2.pdf"));
  await writeFile(destinations[0], "%PDF-saved");
  await assert.rejects(batches.destination(first.id, "a"), /déjà enregistré/);
  const second = await batches.begin(root, documents);
  assert.notEqual(first.name, second.name);
  assert.equal(await readFile(destinations[0], "utf8"), "%PDF-saved");
  batches.finish(second.id);
  await assert.rejects(batches.destination(second.id, "a"), /expiré/);
});

test("batch export rejects traversal, absolute paths and duplicate document IDs", async (t) => {
  const root = await temporary(t), batches = new BatchExports();
  for (const relativePath of ["../secret.pdf", "/tmp/secret.pdf", "foo/../../secret.pdf", "foo\\..\\secret.pdf"]) {
    await assert.rejects(batches.begin(root, [{ id: "a", name: "x.pdf", relativePath }]), /relative path/);
  }
  await assert.rejects(batches.begin(root, [{ id: "a", name: "x.pdf" }, { id: "a", name: "y.pdf" }]), /document/);
});

test("Linux integration quotes the executable and only adds/removes its own desktop files", async (t) => {
  const root = await temporary(t);
  const executable = path.join(root, 'Inklura $test `literal` 100%.AppImage');
  const entry = desktopEntry(executable, "/tmp/icon.png");
  assert.match(entry, /-- %F/);
  assert.match(entry, /100%%\.AppImage/);
  assert.ok(entry.includes('\\\\$test'));
  assert.match(entry, /MimeType=application\/pdf;inode\/directory;/);
  assert.throws(() => desktopEntry("/tmp/app\nExec=evil", "icon"));
  const icon = path.join(root, "icon.png");
  await writeFile(icon, "icon");
  await mkdir(path.join(root, "applications"));
  await writeFile(path.join(root, "applications", "unrelated.desktop"), "untouched");
  await installDesktopEntry({ dataHome: root, executable, icon });
  assert.match(await readFile(path.join(root, "applications", "com.benfavre.caviard.desktop"), "utf8"), /Inklura PDF/);
  await removeDesktopEntry(root);
  assert.equal(await readFile(path.join(root, "applications", "unrelated.desktop"), "utf8"), "untouched");
});
