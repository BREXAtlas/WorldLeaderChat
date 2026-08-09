import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { extractCandidateFingerprint, extractStoryBundle } from "./lib/editorial.mjs";
import { appendGitHubOutput, readJson, writeJson } from "./lib/io.mjs";
import { assertValid, validateApprovedBundle } from "./lib/validation.mjs";

const root = process.cwd();
const eventPath = process.env.GITHUB_EVENT_PATH;
if (!eventPath) throw new Error("GITHUB_EVENT_PATH is required.");

const githubEvent = JSON.parse(await readFile(eventPath, "utf8"));
const issue = githubEvent.issue;
if (!issue) throw new Error("The GitHub event does not contain an issue.");

const actor = githubEvent.sender?.login || process.env.GITHUB_ACTOR || "unknown";
const labels = issue.labels.map((label) => typeof label === "string" ? label : label.name);
const policy = await readJson(resolve(root, "config/editorial-policy.json"));
const expectedFingerprint = extractCandidateFingerprint(issue.body);
const bundle = extractStoryBundle(issue.body);

bundle.approval = {
  ...(bundle.approval ?? {}),
  approvedBy: actor,
  approvedAt: new Date().toISOString(),
  issueNumber: issue.number,
  issueUrl: issue.html_url
};

const errors = validateApprovedBundle(bundle, policy, { labels, expectedFingerprint });
assertValid(errors, `Editorial issue #${issue.number} is not publishable`);

const publishedPath = resolve(root, "data/published-events.json");
const logPath = resolve(root, "data/editorial-log.json");
const metaPath = resolve(root, "data/site-meta.json");
const published = await readJson(publishedPath, []);
const log = await readJson(logPath, []);
const fingerprint = bundle.ingestion.fingerprint;

const existingByFingerprint = published.find((event) => event.editorial?.fingerprint === fingerprint);
const existingById = published.find((event) => event.id === bundle.event.id);
if (existingByFingerprint || (existingById && existingById.editorial?.fingerprint === fingerprint)) {
  const eventId = existingByFingerprint?.id || existingById.id;
  console.log(`Issue #${issue.number} already published as ${eventId}; no data change required.`);
  await appendGitHubOutput("published", "false");
  await appendGitHubOutput("already_published", "true");
  await appendGitHubOutput("event_id", eventId);
  process.exit(0);
}
if (existingById) {
  throw new Error(`Event id '${bundle.event.id}' already belongs to a different editorial record.`);
}

const incomingUrls = new Set(bundle.event.sources.map((source) => source.url));
for (const event of published) {
  for (const source of event.sources ?? []) {
    if (incomingUrls.has(source.url)) {
      throw new Error(`Source URL is already published under event '${event.id}'.`);
    }
  }
}

const approvedAt = bundle.approval.approvedAt;
const event = {
  ...bundle.event,
  publishedAt: approvedAt,
  editorial: {
    issueNumber: issue.number,
    issueUrl: issue.html_url,
    approvedBy: actor,
    approvedAt,
    fingerprint,
    sourcePublishedAt: bundle.ingestion.sourcePublishedAt ?? null,
    singleSourceException: String(bundle.factCheck.singleSourceException ?? "").trim(),
    reviewNotes: String(bundle.approval.reviewNotes ?? "").trim()
  }
};

published.push(event);
published.sort((a, b) => {
  const dateOrder = String(b.eventDate).localeCompare(String(a.eventDate));
  return dateOrder || String(a.id).localeCompare(String(b.id));
});

log.push({
  schemaVersion: 1,
  eventId: event.id,
  issueNumber: issue.number,
  issueUrl: issue.html_url,
  approvedBy: actor,
  approvedAt,
  fingerprint,
  sourceUrls: event.sources.map((source) => source.url)
});

const latestEventDate = published[0]?.eventDate ?? null;
await writeJson(publishedPath, published);
await writeJson(logPath, log);
await writeJson(metaPath, {
  schemaVersion: 1,
  generatedAt: approvedAt,
  publishedEventCount: published.length,
  latestEventDate
});

await appendGitHubOutput("published", "true");
await appendGitHubOutput("already_published", "false");
await appendGitHubOutput("event_id", event.id);
console.log(`Published '${event.id}' from editorial issue #${issue.number}.`);
