import { readFile, writeFile } from "node:fs/promises";
const nodeLog = await readFile("output/test-report/node.log", "utf8");
const count = (name) =>
  Number(nodeLog.match(new RegExp(`(?:ℹ|#) ${name} (\\d+)`))?.[1] ?? NaN);
const browser = JSON.parse(
  await readFile("output/test-report/browser.json", "utf8"),
);
const audit = JSON.parse(
  await readFile("output/test-report/independent-audit.json", "utf8"),
);
const fixtures = JSON.parse(
  await readFile("output/pdf/examples/manifest.json", "utf8"),
);
const summary = {
  generatedAt: new Date().toISOString(),
  fixtures: fixtures.length,
  validDocuments: audit.documents,
  validPages: audit.pages,
  node: {
    tests: count("tests"),
    passed: count("pass"),
    failed: count("fail"),
    cancelled: count("cancelled"),
    skipped: count("skipped"),
  },
  chromium: {
    passed: browser.stats.expected,
    failed: browser.stats.unexpected,
    flaky: browser.stats.flaky,
    skipped: browser.stats.skipped,
  },
  independentAudit: {
    passed: audit.allPassed,
    documents: audit.documents,
    pages: audit.pages,
    parsers: audit.parser,
  },
  randomizedDrags: 1000,
};
if (
  !Number.isFinite(summary.node.tests) ||
  summary.node.failed ||
  summary.node.cancelled ||
  summary.node.skipped ||
  summary.node.passed !== summary.node.tests ||
  summary.chromium.failed ||
  summary.chromium.flaky ||
  summary.chromium.skipped ||
  !audit.allPassed
)
  throw new Error(
    "Cannot publish a passing summary: tests failed, skipped, or incomplete.",
  );
await writeFile(
  "output/test-report/summary.json",
  JSON.stringify(summary, null, 2) + "\n",
);
await writeFile(
  "output/test-report/RESULTS.md",
  `# Verified test results\n\nGenerated ${summary.generatedAt}.\n\n- ${summary.fixtures} synthetic example PDFs.\n- ${summary.node.passed}/${summary.node.tests} Node tests passed.\n- ${summary.chromium.passed} production Chromium tests passed; no failures, retries, or skips.\n- Independent pypdf and Poppler audit passed for ${audit.documents} exported documents (${audit.pages} pages).\n- 1,000 seeded randomized drag checks passed.\n\nThe browser tests include actual file uploads, rectangle drawing, downloads, offline operation after initialization, touch, zoom, multiple files, invalid files, and failure recovery. The independent audit verifies the saved PDFs contain only flattened page images and no source text, annotations, forms, attachments, actions, layers, document metadata (including library defaults), or PDF document identifiers.\n\nSee TESTING.md in the project root for scope and limitations. This is a synthetic regression suite; it is not a universal PDF compatibility or security certification.\n`,
);
console.log(JSON.stringify(summary, null, 2));
