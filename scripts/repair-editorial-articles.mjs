import { extractStoryBundle, STORY_JSON_END, STORY_JSON_START } from "./lib/editorial.mjs";
import { articleProblems, normalizeArticle } from "./lib/article-standard.mjs";

const repository = process.env.GITHUB_REPOSITORY || "BREXAtlas/WorldLeaderChat";
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
const apply = process.env.WLC_APPLY === "1";
const selected = String(process.env.WLC_ISSUE_NUMBERS || "")
  .split(",")
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isInteger(value) && value > 0);

if (!token) throw new Error("GITHUB_TOKEN or GH_TOKEN is required.");

async function github(path, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "world-leader-chat-editorial-repair",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`GitHub ${response.status}: ${payload?.message || text}`);
  return payload;
}

function replaceBundle(body, bundle) {
  const start = body.indexOf(STORY_JSON_START);
  const end = body.indexOf(STORY_JSON_END);
  if (start < 0 || end < start) throw new Error("Editorial JSON markers are missing.");
  const replacement = `${STORY_JSON_START}\n\`\`\`json\n${JSON.stringify(bundle, null, 2)}\n\`\`\`\n`;
  return `${body.slice(0, start)}${replacement}${body.slice(end)}`;
}

async function issuesToCheck() {
  if (selected.length) {
    return Promise.all(selected.map((number) => github(`/repos/${repository}/issues/${number}`)));
  }
  const issues = await github(`/repos/${repository}/issues?state=open&labels=news-candidate&per_page=100`);
  return issues.filter((issue) => !issue.pull_request && issue.body?.includes(STORY_JSON_START));
}

const issues = await issuesToCheck();
let changed = 0;

for (const issue of issues) {
  const bundle = extractStoryBundle(issue.body);
  const before = JSON.stringify(bundle.event.article);
  bundle.event.article = normalizeArticle(bundle.event.article, bundle.event.sources);
  const problems = articleProblems(bundle.event.article, bundle.event.sources);
  const after = JSON.stringify(bundle.event.article);
  if (before === after) continue;
  if (problems.length) {
    console.log(`#${issue.number}: skipped; normalized report still fails: ${problems.join(" ")}`);
    continue;
  }

  changed += 1;
  console.log(`#${issue.number}: ${apply ? "repairing" : "would repair"} article/source-credit structure`);
  if (!apply) continue;

  await github(`/repos/${repository}/issues/${issue.number}`, {
    method: "PATCH",
    body: JSON.stringify({ body: replaceBundle(issue.body, bundle) })
  });

  const labels = issue.labels.map((label) => typeof label === "string" ? label : label.name);
  if (labels.includes("publication-failed")) {
    await github(`/repos/${repository}/issues/${issue.number}/labels/publication-failed`, { method: "DELETE" });
    console.log(`#${issue.number}: cleared publication-failed; owner approval is still required`);
  }
}

console.log(`${apply ? "Repaired" : "Found"} ${changed} editorial issue${changed === 1 ? "" : "s"}.`);
