import { appendFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const reportPath = resolve(process.cwd(), process.env.INGESTION_OUTPUT || "tmp/ingestion-candidates.json");
const report = JSON.parse(await readFile(reportPath, "utf8"));
const coverage = report.publisherCoverage || { distinctPublishers: 0, publishers: {}, desks: {} };
const publisherList = Object.keys(coverage.publishers || {}).join(", ") || "none";
const left = coverage.orientations?.left || { distinctPublishers: 0, publishers: {} };
const right = coverage.orientations?.right || { distinctPublishers: 0, publishers: {} };
const neutral = coverage.orientations?.neutral || { distinctPublishers: 0, publishers: {} };
const lines = [
  `- Selected publisher mix (${coverage.distinctPublishers}): ${publisherList}`,
  `- Left-designated sources (${left.distinctPublishers}): ${Object.keys(left.publishers).join(", ") || "none"}`,
  `- Right-designated sources (${right.distinctPublishers}): ${Object.keys(right.publishers).join(", ") || "none"}`,
  `- Neutral/specialty/primary sources (${neutral.distinctPublishers}): ${Object.keys(neutral.publishers).join(", ") || "none"}`,
  ...Object.entries(coverage.desks || {}).map(([desk, detail]) =>
    `- ${desk} sources (${detail.distinctPublishers}): ${Object.keys(detail.publishers || {}).join(", ") || "none"}`
  )
];
const output = `${lines.join("\n")}\n`;

if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, output, "utf8");
} else {
  process.stdout.write(output);
}
