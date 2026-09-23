import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ruleEntities,
  validIban,
  validCard,
  parsePlan,
  spanRegions,
  textChunks,
  filterEntities,
} from "../src/ai/core.mjs";
import { textIndex, ocrIndex } from "../src/ai/geometry.mjs";
import { redactionHistory, emptyHistory } from "../src/history.mjs";
const plan = {
  categories: ["email", "phone", "iban", "card"],
  literals: [],
  exclude: [],
};
test("French contact rules and bank checksums reject misleading numbers", () => {
  const text =
    "Élodie: elodie.martin@example.fr ; +33 6 12 34 56 78\nIBAN FR76 3000 6000 0112 3456 7890 189 BIC ABCDFRPP\nCarte 4111 1111 1111 1111";
  const found = ruleEntities(text, plan);
  assert.deepEqual(found.map((e) => e.category).sort(), [
    "card",
    "email",
    "iban",
    "phone",
  ]);
  found.forEach((e) => assert.equal(text.slice(e.start, e.end), e.text));
  assert.ok(validIban("FR76 3000 6000 0112 3456 7890 189"));
  assert.ok(!validIban("FR76 3000 6000 0112 3456 7890 188"));
  assert.ok(!validCard("0000 0000 0000 0000"));
  assert.ok(!validCard("4111 1111 1111 1112"));
});
test("literal matches preserve Unicode offsets and escape regular expressions", () => {
  const text = "😊 Client A+B (test). A+B";
  const found = ruleEntities(text, {
    categories: [],
    literals: ["A+B"],
    exclude: [],
  });
  assert.equal(found.length, 2);
  found.forEach((e) => assert.equal(text.slice(e.start, e.end), "A+B"));
});
test("model plans accept only bounded categories and grounded exact text", () => {
  assert.deepEqual(
    parsePlan(
      '{"categories":["person","email"],"exclude":["Inklura"]}',
      "Masque les noms sauf Inklura",
    ).categories,
    ["person", "email"],
  );
  for (const bad of [
    "{}",
    '{"categories":["execute"]}',
    '{"categories":["person"],"exclude":["unrequested"]}',
    '{"categories":["person"],"unsupported":true}',
  ])
    assert.throws(() => parsePlan(bad, "Masque les noms"));
});
test("overlapping windows retain accented names and never silently truncate", () => {
  const text = Array.from({ length: 350 }, (_, i) => `Élodie${i}`).join(" "),
    chunks = textChunks(text);
  assert.equal(chunks[0].start, 0);
  assert.ok(chunks.at(-1).text.endsWith("Élodie349"));
  chunks.forEach((c) =>
    assert.equal(text.slice(c.start, c.start + c.text.length), c.text),
  );
  assert.ok(chunks[1].start < chunks[0].text.length);
});
test("exclusions and duplicate detections have bounded effect", () => {
  const e = { start: 0, end: 7, text: "Inklura", category: "organization" };
  const other = { start: 10, end: 14, text: "Paul", category: "person" };
  assert.deepEqual(
    filterEntities([e, other, other], { exclude: ["Inklura"] }),
    [other],
  );
});
for (const [rotation, matrix, width, height] of [
  [0, [1, 0, 0, -1, 0, 800], 600, 800],
  [90, [0, 1, 1, 0, 0, 0], 800, 600],
  [180, [-1, 0, 0, 1, 600, 0], 600, 800],
  [270, [0, -1, -1, 0, 800, 600], 800, 600],
])
  test(`text rectangles cover the complete item on a ${rotation}° page`, () => {
    const item = {
      str: "Élodie Martin",
      width: 100,
      transform: [12, 0, 0, 12, 50, 700],
      fontName: "f",
    };
    const idx = textIndex(
      { items: [item], styles: { f: { ascent: 0.8, descent: -0.2 } } },
      { transform: matrix, width, height },
    );
    const r = spanRegions(idx, { start: 0, end: 6 })[0];
    assert.ok(r.width > 0 && r.height > 0);
    assert.ok(
      r.x >= 0 && r.y >= 0 && r.x + r.width <= 1 && r.y + r.height <= 1,
    );
    const points = [
      [50, 700],
      [150, 700],
    ].map(([x, y]) => [
      matrix[0] * x + matrix[2] * y + matrix[4],
      matrix[1] * x + matrix[3] * y + matrix[5],
    ]);
    for (const [x, y] of points) {
      assert.ok(r.x * width <= x && (r.x + r.width) * width >= x);
      assert.ok(r.y * height <= y && (r.y + r.height) * height >= y);
    }
  });
test("OCR words retain coordinates and text offsets", () => {
  const idx = ocrIndex(
    {
      blocks: [
        {
          paragraphs: [
            {
              lines: [
                {
                  words: [
                    {
                      text: "Jean",
                      confidence: 91,
                      bbox: { x0: 20, y0: 30, x1: 60, y1: 45 },
                    },
                    {
                      text: "Dupont",
                      confidence: 90,
                      bbox: { x0: 70, y0: 30, x1: 120, y1: 45 },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    200,
    200,
  );
  assert.equal(idx.text.trim(), "Jean Dupont");
  assert.equal(spanRegions(idx, { start: 0, end: 11 }).length, 2);
  assert.ok(idx.items[0].rect.x < 0.1);
});
test("one automatic policy application is one undo step and preserves manual marks", () => {
  const manual = { id: "manual" },
    a = { id: "a" },
    b = { id: "b" };
  let s = redactionHistory(emptyHistory, {
    type: "add",
    id: "doc",
    mark: manual,
  });
  s = redactionHistory(s, { type: "batch", id: "doc", marks: [a, b] });
  assert.equal(s.marks.doc.length, 3);
  s = redactionHistory(s, { type: "undo", id: "doc" });
  assert.deepEqual(s.marks.doc, [manual]);
  s = redactionHistory(s, { type: "redo", id: "doc" });
  assert.deepEqual(s.marks.doc, [manual, a, b]);
});

test("instruction exceptions are explicit quoted text and broad policies have stable categories", async () => {
  const { instructionDetails, completeInstructionPlan } =
    await import("../src/ai/core.mjs");
  assert.deepEqual(instructionDetails("Masque les noms sauf « Inklura »."), {
    literals: [],
    exclude: [" Inklura "],
  });
  assert.throws(() => instructionDetails("Masque les noms sauf Inklura."));
  assert.deepEqual(
    completeInstructionPlan(
      { categories: ["person"] },
      "Masque les coordonnées des clients.",
    ).categories,
    ["person", "address", "email", "phone"],
  );
  assert.deepEqual(
    completeInstructionPlan({ categories: [] }, "Masque « Projet Neptune ».")
      .literals,
    ["Projet Neptune"],
  );
});

test("OCR rectangles map into rotated viewports and inverse rotation restores them", async () => {
  const { rotateRect } = await import("../src/ai/geometry.mjs");
  const original = { x: 0.1, y: 0.2, width: 0.3, height: 0.05 };
  for (const angle of [0, 90, 180, 270]) {
    const rotated = rotateRect(original, angle),
      restored = rotateRect(rotated, 360 - angle);
    for (const key of Object.keys(original))
      assert.ok(Math.abs(original[key] - restored[key]) < 1e-12);
  }
});
