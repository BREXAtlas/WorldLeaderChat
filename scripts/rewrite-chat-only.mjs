import { resolve } from "node:path";
import { extractStoryBundle, STORY_JSON_END, STORY_JSON_START } from "./lib/editorial.mjs";
import { readJson } from "./lib/io.mjs";
import { buildDirectDialogue, closingLineFor } from "./lib/article-dialogue.mjs";
import { dialogueProblems } from "./lib/chat-quality.mjs";

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const apiBase = process.env.GITHUB_API_URL || "https://api.github.com";
const issueNumber = Number(process.env.WLC_TARGET_ISSUE || 0);

if (!token) throw new Error("GITHUB_TOKEN is required.");
if (!repository || !repository.includes("/")) throw new Error("GITHUB_REPOSITORY must be owner/name.");
if (!Number.isInteger(issueNumber) || issueNumber <= 0) throw new Error("WLC_TARGET_ISSUE must be a positive issue number.");

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
  if (!response.ok) throw new Error(`GitHub API ${options.method || "GET"} ${path} failed (${response.status}): ${payload?.message || text}`);
  return payload;
}

function labelNames(issue) {
  return new Set((issue.labels || []).map((label) => typeof label === "string" ? label : label.name));
}

function replaceBundle(body, bundle) {
  const start = body.indexOf(STORY_JSON_START);
  const end = body.indexOf(STORY_JSON_END);
  if (start < 0 || end <= start) throw new Error("Issue is missing editorial JSON markers.");
  const block = `${STORY_JSON_START}\n\`\`\`json\n${JSON.stringify(bundle, null, 2)}\n\`\`\`\n${STORY_JSON_END}`;
  return body.slice(0, start) + block + body.slice(end + STORY_JSON_END.length);
}

async function setLabels(issue, additions = [], removals = []) {
  const labels = labelNames(issue);
  additions.forEach((label) => labels.add(label));
  removals.forEach((label) => labels.delete(label));
  return github(`/repos/${repository}/issues/${issue.number}`, {
    method: "PATCH",
    body: { labels: [...labels] }
  });
}

const issue = await github(`/repos/${repository}/issues/${issueNumber}`);
const labels = labelNames(issue);
if (issue.state !== "open" || labels.has("published") || labels.has("rejected")) {
  throw new Error(`Issue #${issueNumber} is not an active editorial candidate.`);
}

let bundle = extractStoryBundle(issue.body || "");
const originalArticle = structuredClone(bundle.event?.article ?? null);
const originalTitle = bundle.event?.title;
const originalKicker = bundle.event?.kicker;
const originalCategory = bundle.event?.category;

bundle.event.messages = buildDirectDialogue(bundle);
bundle.event.meme = closingLineFor(bundle);

// A chat rewrite must never silently rewrite the already-reviewed article.
bundle.event.article = originalArticle;
bundle.event.title = originalTitle;
bundle.event.kicker = originalKicker;
bundle.event.category = originalCategory;
bundle.approval = {
  ...(bundle.approval || {}),
  conversationStyle: "article-specific-direct-chat",
  targetMessageCount: "10-14",
  dialogueQuality: "deterministic article-specific direct exchanges; article and sources preserved",
  dialogueRefinedAt: new Date().toISOString(),
  reviewNotes: `${bundle.approval?.reviewNotes || ""} Chat-only rewrite preserved the existing article and sources while replacing every dialogue line with an event-specific direct exchange.`.trim()
};

const published = await readJson(resolve(process.cwd(), "data/published-events.json"), []);
const problems = dialogueProblems(bundle, { existingBundles: published.map((event) => ({ event })) });
if (problems.length) {
  await setLabels(issue, ["needs-editor"], ["regenerate-requested", "drafting", "ready-for-approval"]);
  throw new Error(`Chat-only rewrite failed quality checks: ${problems.join(" | ")}`);
}

const updated = await github(`/repos/${repository}/issues/${issueNumber}`, {
  method: "PATCH",
  body: { body: replaceBundle(issue.body || "", bundle) }
});
await setLabels(updated, ["ready-for-approval"], ["regenerate-requested", "drafting", "needs-editor", "editorial-approved", "fact-checked", "publication-failed"]);
console.log(`Rewrote only the chat for issue #${issueNumber}; article and sources were preserved.`);
