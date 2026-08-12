import { extractStoryBundle } from "./lib/editorial.mjs";

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const targetIssue = Number(process.env.WLC_TARGET_ISSUE || 0);
const todayOnly = process.env.WLC_TODAY_ONLY === "1" || process.env.WLC_TODAY_ONLY === "true";

if (!token) throw new Error("GITHUB_TOKEN is required.");
if (!repository || !repository.includes("/")) throw new Error("GITHUB_REPOSITORY must be owner/name.");

async function github(path) {
  const response = await fetch(`${process.env.GITHUB_API_URL || "https://api.github.com"}${path}`, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28"
    }
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`GitHub API ${path} failed (${response.status}): ${payload?.message || text}`);
  return payload;
}

function chicagoDateKey(value = Date.now()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

const today = chicagoDateKey();
const issues = await github(`/repos/${repository}/issues?state=open&labels=news-candidate&per_page=100`);
const unresolved = issues.filter((issue) => {
  if (issue.pull_request || (targetIssue && issue.number !== targetIssue)) return false;
  let bundle;
  try { bundle = extractStoryBundle(issue.body || ""); } catch { return true; }
  if (todayOnly && bundle.event?.eventDate !== today) return false;
  const labels = new Set((issue.labels || []).map((label) => typeof label === "string" ? label : label.name));
  return !labels.has("ready-for-approval")
    && !labels.has("published")
    && !labels.has("rejected")
    && !labels.has("editorial-approved");
});

if (unresolved.length) {
  const ids = unresolved.slice(0, 20).map((issue) => `#${issue.number}`).join(", ");
  throw new Error(`${unresolved.length} ${todayOnly ? `${today} ` : ""}article(s) remain outside Ready for Approval: ${ids}${unresolved.length > 20 ? ", …" : ""}`);
}

console.log(`Readiness confirmed: every ${todayOnly ? `${today} ` : ""}candidate in scope is ready, publishing, published or rejected.`);
