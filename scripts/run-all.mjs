import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { createWriteStream } from "node:fs";
await mkdir("output/test-report", { recursive: true });
async function run(command, args, logFile) {
  const log = logFile ? createWriteStream(logFile) : null;
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["inherit", "pipe", "pipe"] });
    child.stdout.on("data", (data) => {
      process.stdout.write(data);
      log?.write(data);
    });
    child.stderr.on("data", (data) => {
      process.stderr.write(data);
      log?.write(data);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      log?.end();
      code === 0
        ? resolve()
        : reject(new Error(`${command} ${args.join(" ")} failed (${code}).`));
    });
  });
}
try {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  await run(npm, ["test"], "output/test-report/node.log");
  await run(npm, ["run", "test:e2e"], "output/test-report/browser.log");
  await run(npm, ["run", "test:audit"], "output/test-report/audit.log");
  await run(process.execPath, ["scripts/summarize-tests.mjs"]);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
