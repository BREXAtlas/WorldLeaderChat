import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const targetIssue = Number(process.env.WLC_TARGET_ISSUE || 0);
const batchSize = Math.max(1, Number(process.env.WLC_DRAFT_BATCH_SIZE || 10));
const dailyLimit = Math.max(batchSize, Number(process.env.WLC_DAILY_DRAFT_LIMIT || 30));
const runLimit = targetIssue ? 1 : dailyLimit;
const attemptedIssues = new Set();
const resultDirectory = mkdtempSync(join(tmpdir(), "wlc-draft-batches-"));

console.log(`Starting newsroom writing batches of up to ${batchSize} until the ${runLimit}-article run ceiling is reached or the eligible queue is empty.`);
try {
  while (attemptedIssues.size < runLimit) {
    const limit = targetIssue ? 1 : Math.min(batchSize, runLimit - attemptedIssues.size);
    const resultPath = join(resultDirectory, `batch-${attemptedIssues.size}.json`);
    const result = spawnSync(process.execPath, ["scripts/draft-editorial-issues.mjs"], {
      stdio: "inherit",
      env: {
        ...process.env,
        WLC_DRAFT_LIMIT: String(limit),
        WLC_DRAFT_RESULT_PATH: resultPath,
        WLC_SKIP_ISSUES: [...attemptedIssues].join(",")
      }
    });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status || 1);

    const batch = JSON.parse(readFileSync(resultPath, "utf8"));
    const selected = Array.isArray(batch.selectedIssueNumbers) ? batch.selectedIssueNumbers : [];
    selected.forEach((issueNumber) => attemptedIssues.add(Number(issueNumber)));
    console.log(`Writing batch finished: ${selected.length} attempted, ${batch.drafted || 0} ready, ${batch.blocked || 0} blocked.`);
    if (selected.length < limit || targetIssue) break;
  }
} finally {
  rmSync(resultDirectory, { recursive: true, force: true });
}

console.log(`Newsroom writing run finished after attempting ${attemptedIssues.size} unique article${attemptedIssues.size === 1 ? "" : "s"}.`);
