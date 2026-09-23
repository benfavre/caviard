import { stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
const generated = await stat("output/pdf/examples/manifest.json").catch(
  () => null,
);
const generator = await stat("scripts/generate-examples.py");
if (!generated || generated.mtimeMs < generator.mtimeMs) {
  const result = spawnSync(
    process.execPath,
    ["scripts/python.mjs", "scripts/generate-examples.py"],
    { stdio: "inherit" },
  );
  if (result.status !== 0) {
    console.error(
      "Install fixture dependencies: python3 -m pip install --target .test-deps -r tests/requirements.txt",
    );
    process.exit(result.status ?? 1);
  }
}
