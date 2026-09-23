import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { ModelStore } from "../../electron/ai-models.mjs";
const data = Buffer.from("pinned model"),
  file = {
    path: "ner/model.onnx",
    url: "https://example.invalid/model",
    size: data.length,
    sha256: createHash("sha256").update(data).digest("hex"),
  };
test("model download verifies bytes, caches valid files, and rejects arbitrary paths", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "inklura-model-"));
  let calls = 0;
  try {
    const store = new ModelStore(root, {
      files: [file],
      fetcher: async () => {
        calls++;
        return new Response(data);
      },
    });
    assert.equal(store.file("../private"), null);
    assert.equal((await store.status()).phase, "missing");
    assert.equal((await store.install()).phase, "ready");
    assert.deepEqual(await readFile(store.file(file.path)), data);
    await store.install();
    assert.equal(calls, 1);
    await writeFile(store.file(file.path), Buffer.alloc(data.length));
    await store.install();
    assert.equal(calls, 2);
    assert.deepEqual(await readFile(store.file(file.path)), data);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("bad or oversized downloads never become installed models", async () => {
  for (const bytes of [
    Buffer.alloc(data.length),
    Buffer.alloc(data.length + 1),
  ]) {
    const root = await mkdtemp(path.join(os.tmpdir(), "inklura-model-"));
    try {
      const store = new ModelStore(root, {
        files: [file],
        fetcher: async () => new Response(bytes),
      });
      assert.equal((await store.install()).phase, "error");
      await assert.rejects(readFile(store.file(file.path)));
      await assert.rejects(readFile(store.file(file.path) + ".part"));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});
test("cancel interrupts an in-progress download and removes partial files", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "inklura-model-"));
  try {
    const store = new ModelStore(root, {
      files: [file],
      fetcher: async (_url, { signal }) =>
        new Promise((_resolve, reject) =>
          signal.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          ),
        ),
    });
    const installing = store.install();
    setTimeout(() => store.cancel(), 10);
    assert.equal((await installing).phase, "missing");
    await assert.rejects(readFile(store.file(file.path)));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
