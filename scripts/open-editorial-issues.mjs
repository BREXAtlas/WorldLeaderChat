import { resolve } from "node:path";
import { createDraftBundle, createEditorialIssueBody, extractStoryBundle } from "./lib/editorial.mjs";
import { cleanWhitespace, readJson } from "./lib/io.mjs";

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const apiBase = process.env.GITHUB_API_URL || "https://api.github.com";
const serverUrl = process.env.GITHUB_SERVER_URL || "https://github.com";
const inputPath = resolve(process.cwd(), process.env.INGESTION_OUTPUT || "tmp/ingestion-candidates.json");
const dailyCandidateLimit = Math.max(1, Number(process.env.WLC_DAILY_CANDIDATE_LIMIT || 20));

if (!token) throw new Error("GITHUB_TOKEN is required.");
if (!repository || !repository.includes("/")) throw new Error("GITHUB_REPOSITORY must be owner/name.");

async function github(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    method: options.method || "GET",
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-github-api-version": "2022-11-28"
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  if (response.status === 204) return null;
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`GitHub API ${options.method || "GET"} ${path} failed (${response.status}): ${payload?.message || text}`);
  }
  return payload;
}

const labelDefinitions = [
  { name: "news-candidate", color: "b60205", description: "Automated world-news candidate awaiting editorial review" },
  { name: "needs-editor", color: "d93f0b", description: "Automated newsroom draft is being corrected before owner review" },
  { name: "fact-checked", color: "1d76db", description: "Editor confirms the factual fields and sources were checked" },
  { name: "editorial-approved", color: "0e8a16", description: "Authorized editor approves publication" },
  { name: "published", color: "5319e7", description: "Published to World Leader Chat" },
  { name: "publication-failed", color: "d93f0b", description: "Publication failed and is unlocked for retry or rewrite" },
  { name: "daily-overflow", color: "cfd3d7", description: "Retained outside the active newsroom after the daily article limit was reached" },
  { name: "featured-headline", color: "f4d34f", description: "Selected as the public main headline" },
  { name: "rejected", color: "6a737d", description: "Editorially rejected; retained for deduplication" }
];

async function ensureLabels() {
  const existing = await github(`/repos/${repository}/labels?per_page=100`);
  const byName = new Map(existing.map((label) => [label.name, label]));
  for (const definition of labelDefinitions) {
    const current = byName.get(definition.name);
    if (!current) await github(`/repos/${repository}/labels`, { method: "POST", body: definition });
    else if (current.description !== definition.description || current.color !== definition.color) {
      await github(`/repos/${repository}/labels/${encodeURIComponent(definition.name)}`, {
        method: "PATCH",
        body: { new_name: definition.name, color: definition.color, description: definition.description }
      });
    }
  }
}

async function listCandidateIssues() {
  const issues = [];
  for (let page = 1; page <= 50; page += 1) {
    const batch = await github(`/repos/${repository}/issues?state=all&labels=news-candidate&per_page=100&page=${page}`);
    issues.push(...batch.filter((issue) => !issue.pull_request));
    if (batch.length < 100) break;
    if (page === 50) console.warn("Candidate issue scan reached 5,000 issues; older fingerprints may not be deduplicated.");
  }
  return issues;
}

function fingerprintFromBody(body) {
  return String(body ?? "").match(/<!--\s*WLC_FINGERPRINT:\s*([a-f0-9]{64})\s*-->/i)?.[1] ?? null;
}

function safeMarkdown(value) {
  return cleanWhitespace(value).replace(/<!--/g, "&lt;!--").replace(/-->/g, "--&gt;");
}

await ensureLabels();
const report = await readJson(inputPath);
const existingIssues = await listCandidateIssues();
const existingFingerprints = new Set(existingIssues.map((issue) => fingerprintFromBody(issue.body)).filter(Boolean));
const dailyCounts = new Map();
for (const issue of existingIssues) {
  const labels = new Set((issue.labels || []).map((label) => typeof label === "string" ? label : label.name));
  if (labels.has("daily-overflow") || labels.has("rejected")) continue;
  try {
    const date = extractStoryBundle(issue.body || "").event?.eventDate;
    if (date) dailyCounts.set(date, (dailyCounts.get(date) || 0) + 1);
  } catch {}
}
const repositoryUrl = `${serverUrl}/${repository}`;
let created = 0;
let skipped = 0;
let skippedDailyLimit = 0;

for (const candidate of report.candidates ?? []) {
  if (existingFingerprints.has(candidate.fingerprint)) {
    skipped += 1;
    continue;
  }

  const eventDate = createDraftBundle(candidate).event.eventDate;
  if ((dailyCounts.get(eventDate) || 0) >= dailyCandidateLimit) {
    skippedDailyLimit += 1;
    console.log(`Skipped ${candidate.title}: ${eventDate} already has ${dailyCandidateLimit} active article files.`);
    continue;
  }

  const issue = await github(`/repos/${repository}/issues`, {
    method: "POST",
    body: {
      title: `NEWS CANDIDATE: ${safeMarkdown(candidate.title).slice(0, 190)}`,
      body: createEditorialIssueBody(candidate, repositoryUrl),
      labels: ["news-candidate", "needs-editor"]
    }
  });
  existingFingerprints.add(candidate.fingerprint);
  dailyCounts.set(eventDate, (dailyCounts.get(eventDate) || 0) + 1);
  created += 1;
  console.log(`Created editorial issue #${issue.number}: ${issue.html_url}`);
}

console.log(`Editorial queue updated: ${created} created, ${skipped} duplicate(s) skipped, ${skippedDailyLimit} held by the daily limit.`);
if (process.env.GITHUB_OUTPUT) {
  const { appendFileSync } = await import("node:fs");
  appendFileSync(process.env.GITHUB_OUTPUT, `issues_created=${created}\nissues_skipped=${skipped}\n`, "utf8");
  appendFileSync(process.env.GITHUB_OUTPUT, `issues_daily_limit=${skippedDailyLimit}\n`, "utf8");
}
