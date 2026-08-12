import { spawnSync } from "node:child_process";

const targetIssue = Number(process.env.WLC_TARGET_ISSUE || 0);
const batchSize = Math.max(1, Number(process.env.WLC_DRAFT_BATCH_SIZE || 10));
const dailyLimit = Math.max(batchSize, Number(process.env.WLC_DAILY_DRAFT_LIMIT || 30));
const batches = targetIssue ? 1 : Math.ceil(dailyLimit / batchSize);

for (let batch = 1; batch <= batches; batch += 1) {
  const limit = targetIssue ? 1 : Math.min(batchSize, dailyLimit - ((batch - 1) * batchSize));
  console.log(`Starting newsroom writing batch ${batch}/${batches} (up to ${limit} article${limit === 1 ? "" : "s"}).`);
  const result = spawnSync(process.execPath, ["scripts/draft-editorial-issues.mjs"], {
    stdio: "inherit",
    env: { ...process.env, WLC_DRAFT_LIMIT: String(limit) }
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
