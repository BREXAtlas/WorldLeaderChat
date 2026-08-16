import { appendFile } from "node:fs/promises";
import { selectEditorialWork } from "./lib/editorial-worker-queue.mjs";

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const apiBase = process.env.GITHUB_API_URL || "https://api.github.com";
const outputPath = process.env.GITHUB_OUTPUT;

if (!token) throw new Error("GITHUB_TOKEN is required.");
if (!repository || !repository.includes("/")) throw new Error("GITHUB_REPOSITORY must be owner/name.");
if (!outputPath) throw new Error("GITHUB_OUTPUT is required.");

async function github(path) {
  const response = await fetch(`${apiBase}${path}`, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28"
    }
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`GitHub API GET ${path} failed (${response.status}): ${payload?.message || text}`);
  return payload;
}

async function openCandidates() {
  const issues = [];
  for (let page = 1; ; page += 1) {
    const batch = await github(`/repos/${repository}/issues?state=open&labels=news-candidate&per_page=100&page=${page}`);
    issues.push(...batch);
    if (batch.length < 100) return issues;
  }
}

const result = selectEditorialWork(await openCandidates(), {
  forceBatch: process.env.WLC_FORCE_BATCH === "1" || process.env.WLC_FORCE_BATCH === "true",
  todayOnly: process.env.WLC_TODAY_ONLY !== "0" && process.env.WLC_TODAY_ONLY !== "false",
  targetIssue: process.env.WLC_TARGET_ISSUE,
  targetAction: process.env.WLC_TARGET_ACTION,
  limit: process.env.WLC_WORKER_LIMIT || 20
});
const matrix = JSON.stringify({ include: result.selected });

await appendFile(outputPath, `matrix=${matrix}\ncount=${result.selected.length}\nremaining=${result.remaining}\nbatch_requested=${result.batchRequested ? "1" : "0"}\n`, "utf8");
console.log(`Editorial worker selected ${result.selected.length} file(s); ${result.remaining} eligible file(s) remain after this run.`);
if (result.invalid.length) console.warn(`::warning title=Unreadable editorial files::The following selected issues have invalid editorial bundles and will fail safely: ${result.invalid.map((number) => `#${number}`).join(", ")}`);
