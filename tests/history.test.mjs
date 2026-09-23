import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyHistory, redactionHistory as reduce } from "../src/history.mjs";
test("undo/redo restores removed regions and clear operations without crossing documents", () => {
  let state = reduce(emptyHistory, {
    type: "add",
    id: "a",
    mark: { id: "one" },
  });
  state = reduce(state, { type: "add", id: "a", mark: { id: "two" } });
  state = reduce(state, { type: "add", id: "b", mark: { id: "other" } });
  state = reduce(state, { type: "remove", id: "a", markId: "one" });
  state = reduce(state, { type: "undo", id: "a" });
  assert.deepEqual(state.marks.a, [{ id: "one" }, { id: "two" }]);
  state = reduce(state, { type: "redo", id: "a" });
  assert.deepEqual(state.marks.a, [{ id: "two" }]);
  state = reduce(state, { type: "clear", id: "a" });
  assert.deepEqual(state.marks.a, []);
  state = reduce(state, { type: "undo", id: "a" });
  assert.deepEqual(state.marks.a, [{ id: "two" }]);
  assert.deepEqual(state.marks.b, [{ id: "other" }]);
  state = reduce(state, { type: "close", id: "a" });
  for (const values of Object.values(state)) assert.equal(values.a, undefined);
});
test("a new edit after undo invalidates only that document’s redo history", () => {
  let state = reduce(emptyHistory, {
    type: "add",
    id: "a",
    mark: { id: "one" },
  });
  state = reduce(state, { type: "undo", id: "a" });
  const before = state;
  state = reduce(state, { type: "add", id: "a", mark: { id: "two" } });
  assert.deepEqual(state.redo.a, []);
  assert.equal(reduce(state, { type: "redo", id: "a" }), state);
  assert.deepEqual(before.marks.a, []);
  assert.deepEqual(emptyHistory.marks, {});
});
