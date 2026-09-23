import { spawnSync } from "node:child_process";
import path from "node:path";
const result = spawnSync(
  process.env.PYTHON || "python3",
  process.argv.slice(2),
  {
    stdio: "inherit",
    env: {
      ...process.env,
      PYTHONPATH: [path.resolve(".test-deps"), process.env.PYTHONPATH]
        .filter(Boolean)
        .join(path.delimiter),
    },
  },
);
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
