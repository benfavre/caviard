import path from "node:path";
import { ModelStore } from "../electron/ai-models.mjs";
const root = process.argv[2];
if (!root || !path.isAbsolute(root))
  throw new Error("Supply an absolute directory for the optional model pack.");
const store = new ModelStore(root);
let percent = -1;
store.on("state", (state) => {
  const next = Math.floor((state.received / state.total) * 100);
  if (next !== percent || state.phase !== "downloading") {
    percent = next;
    console.log(`${state.phase} ${next}% ${state.message}`);
  }
});
process.once("SIGINT", () => store.cancel());
const result = await store.install();
if (result.phase !== "ready") process.exitCode = 1;
