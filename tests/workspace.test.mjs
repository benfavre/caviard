import { test } from "node:test";
import assert from "node:assert/strict";
import {
  folderTree,
  pageSignature,
  isReviewed,
  documentStatus,
} from "../src/workspace.mjs";
import { emptyHistory, redactionHistory } from "../src/history.mjs";
import { validateProfile } from "../src/profiles.mjs";
const doc = {
  id: "a",
  name: "invoice.pdf",
  relativePath: "Client/sub/invoice.pdf",
  pdf: { numPages: 1 },
};
const region = { id: "r", page: 1, x: 0.1, y: 0.2, width: 0.3, height: 0.1 };
test("review is invalidated by edits and restored by undo, export status handles empty marks", () => {
  const reviewed = { a: { 1: pageSignature([], 1) } };
  assert.equal(isReviewed(doc, 1, {}, reviewed), true);
  const changed = redactionHistory(emptyHistory, {
    type: "add",
    id: "a",
    mark: region,
  });
  assert.equal(isReviewed(doc, 1, changed.marks, reviewed), false);
  const undone = redactionHistory(changed, { type: "undo", id: "a" });
  assert.equal(isReviewed(doc, 1, undone.marks, reviewed), true);
  assert.equal(documentStatus(doc, {}, {}, { a: [] }), "Exporté");
  assert.equal(
    documentStatus(doc, changed.marks, reviewed, { a: [] }),
    "Modifié",
  );
});
test("folder search preserves hierarchy and original document indices", () => {
  const tree = folderTree(
    [
      { ...doc, id: "b", name: "other.pdf", relativePath: "Other/other.pdf" },
      doc,
    ],
    "INVOICE",
  );
  assert.equal(tree.folders.size, 1);
  assert.equal(
    tree.folders.get("Client").folders.get("sub").documents[0].index,
    1,
  );
});
test("bulk regions preserve independent undo histories", () => {
  const state = redactionHistory(emptyHistory, {
    type: "multi",
    groups: { a: [region], b: [{ ...region, id: "s" }] },
  });
  const undone = redactionHistory(state, { type: "undo", id: "a" });
  assert.equal(undone.marks.a.length, 0);
  assert.equal(undone.marks.b.length, 1);
  assert.equal(
    redactionHistory(emptyHistory, { type: "restore", history: state }),
    state,
  );
});
test("profiles validate categories, bounds and exact text without accepting unknown detection categories", () => {
  assert.throws(() =>
    validateProfile({
      name: "x",
      categories: ["unknown"],
      literals: [],
      exclude: [],
    }),
  );
  assert.throws(() =>
    validateProfile({ name: "x", categories: [], literals: [], exclude: [] }),
  );
  assert.throws(() =>
    validateProfile({
      name: "x",
      categories: ["email"],
      literals: ["x".repeat(161)],
      exclude: [],
    }),
  );
  const p = validateProfile({
    name: " Bank ",
    categories: ["iban", "iban"],
    literals: [" secret "],
    exclude: ["Inklura"],
  });
  assert.equal(p.name, "Bank");
  assert.deepEqual(p.categories, ["iban"]);
  assert.deepEqual(p.literals, ["secret"]);
});
