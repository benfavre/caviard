import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import {
  isAppUrl,
  assetPath,
  externalUrl,
  safePdfName,
  pdfBuffer,
} from "../../electron/security.mjs";
test("only the bundled application origin is trusted", () => {
  assert.ok(isAppUrl("caviard://app/"));
  for (const url of [
    "https://app/",
    "file:///tmp/app",
    "caviard://evil/",
    "caviard://user@app/",
    "caviard://app:8/",
  ])
    assert.equal(isAppUrl(url), false);
});
test("asset resolution rejects traversal and foreign origins", () => {
  const root = path.resolve("dist");
  assert.equal(
    assetPath("caviard://app/", root),
    path.join(root, "index.html"),
  );
  for (const url of [
    "caviard://app/%2e%2e%2fsecret",
    "caviard://app/%5csecret",
    "caviard://app/%00",
    "https://evil/app.js",
  ])
    assert.throws(() => assetPath(url, root));
});
test("external links cannot launch local files or executable schemes", () => {
  assert.equal(
    externalUrl("https://github.com/benfavre/caviard"),
    "https://github.com/benfavre/caviard",
  );
  for (const url of [
    "file:///etc/passwd",
    "javascript:alert(1)",
    "http://example.com",
    "https://user:password@example.com",
  ])
    assert.equal(externalUrl(url), null);
});
test("save suggestions are filenames and IPC rejects non-PDF payloads", () => {
  assert.equal(safePdfName("../../été.pdf"), "été.pdf");
  assert.equal(safePdfName("C:\\temp\\file.pdf"), "file.pdf");
  assert.equal(
    pdfBuffer(new Uint8Array(Buffer.from("%PDF-1.7"))).toString(),
    "%PDF-1.7",
  );
  assert.throws(() => pdfBuffer(new Uint8Array([1, 2, 3])));
  assert.throws(() => pdfBuffer("not bytes"));
});
