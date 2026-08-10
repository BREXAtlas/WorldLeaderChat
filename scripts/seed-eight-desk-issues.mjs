import { gunzipSync } from "node:zlib";
import { readFile } from "node:fs/promises";

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const apiBase = process.env.GITHUB_API_URL || "https://api.github.com";
const seedPath = process.env.WLC_DESK_SEED || "config/desk-fill-2026-08-09.json.gz.b64";

if (!token) throw new Error("GITHUB_TOKEN is required.");
if (!repository?.includes("/")) throw new Error("GITHUB_REPOSITORY must be owner/name.");

const requiredDesks = [
  "War & Security",
  "World News",
  "Politics & Society",
  "Technology & AI",
  "Science & Space",
  "Business & Power",
  "Culture & Entertainment",
  "Sports & Soft Power"
];

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
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`GitHub API ${options.method || "GET"} ${path} failed (${response.status}): ${payload?.message || text}`);
  }
  return payload;
}

function issueBody(candidate) {
  const bundle = candidate.bundle;
  const fingerprint = bundle.ingestion.fingerprint;
  return `<!-- WLC_NEWS_CANDIDATE -->
<!-- WLC_FINGERPRINT: ${fingerprint} -->

# Editorial candidate

**Source headline:** ${candidate.sourceHeadline}

**Primary publisher:** ${candidate.primaryPublisher}<br>
**Coverage included:** ${bundle.ingestion.coveragePublishers.join(", ")}<br>
**Published:** ${candidate.publishedAt}<br>
**Desk:** ${candidate.desk}<br>
**Relevance score:** ${bundle.ingestion.relevanceScore}<br>
**Matched terms:** ${candidate.matchedKeywords.join(", ")}

**Original report:** ${candidate.primaryUrl}

## Approval standard

This is a completed desk-fill recommendation. The event and factual conclusion must remain consistent with the linked reporting. The owner can approve, regenerate or reject it from the private editor.

1. Verify the linked sources, names, chronology and factual conclusion.
2. Keep the article engaging and sarcastic without inventing an event, quotation, motive or result.
3. Keep the conversation within the site’s established imagined-reaction format.
4. Sensitive coverage must target powerful people, policy and messaging rather than victims.

<!-- WLC_STORY_JSON_START -->
\`\`\`json
${JSON.stringify(bundle, null, 2)}
\`\`\`
<!-- WLC_STORY_JSON_END -->
`;
}

const encoded = (await readFile(seedPath, "utf8")).trim();
const candidates = JSON.parse(gunzipSync(Buffer.from(encoded, "base64")).toString("utf8"));
if (!Array.isArray(candidates) || candidates.length !== requiredDesks.length) {
  throw new Error(`Expected ${requiredDesks.length} desk-fill candidates.`);
}

const actualDesks = new Set(candidates.map((candidate) => candidate.desk));
for (const desk of requiredDesks) {
  if (!actualDesks.has(desk)) throw new Error(`Desk-fill seed is missing ${desk}.`);
}
for (const candidate of candidates) {
  const messages = candidate.bundle?.event?.messages;
  if (!Array.isArray(messages) || messages.length < 10 || messages.length > 14) {
    throw new Error(`${candidate.desk} must include a 10–14-message conversation.`);
  }
  if ((candidate.bundle?.event?.sources || []).length < 2) {
    throw new Error(`${candidate.desk} must include at least two original sources.`);
  }
}

const existing = [];
for (let page = 1; page <= 5; page += 1) {
  const batch = await github(`/repos/${repository}/issues?state=all&per_page=100&page=${page}`);
  existing.push(...batch);
  if (batch.length < 100) break;
}
const existingFingerprints = new Set();
for (const issue of existing) {
  const match = String(issue.body || "").match(/WLC_FINGERPRINT:\s*([a-f0-9]{64})/i);
  if (match) existingFingerprints.add(match[1].toLowerCase());
}

let created = 0;
let skipped = 0;
for (const candidate of candidates) {
  const fingerprint = candidate.bundle.ingestion.fingerprint.toLowerCase();
  if (existingFingerprints.has(fingerprint)) {
    skipped += 1;
    console.log(`Skipped existing ${candidate.desk} candidate ${fingerprint}.`);
    continue;
  }
  const issue = await github(`/repos/${repository}/issues`, {
    method: "POST",
    body: {
      title: `NEWS CANDIDATE: ${candidate.sourceHeadline}`,
      body: issueBody(candidate),
      labels: ["news-candidate", "ready-for-approval"]
    }
  });
  created += 1;
  console.log(`Created ${candidate.desk} recommendation as issue #${issue.number}.`);
}

console.log(`Eight-desk seed complete: ${created} created, ${skipped} already present.`);
