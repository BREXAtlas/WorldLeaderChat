import { extractStoryBundle, STORY_JSON_END, STORY_JSON_START } from "./lib/editorial.mjs";
import { buildDirectDialogue, dialogueNeedsRefinement } from "./lib/newsroom-dialogue.mjs";

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const apiBase = process.env.GITHUB_API_URL || "https://api.github.com";
const limit = Number(process.env.WLC_REFINE_LIMIT || 50);

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
  if (!response.ok) throw new Error(`GitHub API ${options.method || "GET"} ${path} failed (${response.status}): ${payload?.message || text}`);
  return payload;
}

function labelsOf(issue) {
  return new Set((issue.labels || []).map((label) => typeof label === "string" ? label : label.name));
}

function replaceBundle(body, bundle) {
  const start = body.indexOf(STORY_JSON_START);
  const end = body.indexOf(STORY_JSON_END);
  if (start < 0 || end <= start) throw new Error("Issue is missing editorial JSON markers.");
  const block = `${STORY_JSON_START}\n\`\`\`json\n${JSON.stringify(bundle, null, 2)}\n\`\`\`\n${STORY_JSON_END}`;
  return body.slice(0, start) + block + body.slice(end + STORY_JSON_END.length);
}

const issues = await github(`/repos/${repository}/issues?state=open&labels=news-candidate&per_page=100`);
const queue = issues
  .filter((issue) => !issue.pull_request)
  .filter((issue) => {
    const labels = labelsOf(issue);
    return labels.has("ready-for-approval")
      && !labels.has("published")
      && !labels.has("editorial-approved")
      && !labels.has("rejected");
  })
  .slice(0, limit);

let checked = 0;
let refined = 0;
for (const issue of queue) {
  checked += 1;
  try {
    const bundle = extractStoryBundle(issue.body || "");
    if (!dialogueNeedsRefinement(bundle)) continue;

    bundle.event.messages = buildDirectDialogue(bundle);
    bundle.approval = {
      ...(bundle.approval || {}),
      conversationStyle: "direct-back-and-forth",
      targetMessageCount: "10-14",
      dialogueQuality: "first-person direct dialogue; no meta narration",
      dialogueRefinedAt: new Date().toISOString(),
      reviewNotes: `${bundle.approval?.reviewNotes || ""} Dialogue quality pass replaced descriptive or one-off reactions with direct recurring-speaker exchanges.`.trim()
    };

    await github(`/repos/${repository}/issues/${issue.number}`, {
      method: "PATCH",
      body: { body: replaceBundle(issue.body || "", bundle) }
    });
    refined += 1;
    console.log(`Refined direct conversation for issue #${issue.number}.`);
  } catch (error) {
    console.error(`::warning title=Dialogue refinement failed::Issue #${issue.number}: ${error.message}`);
  }
}

console.log(`Dialogue refinement complete: ${refined} refined of ${checked} ready candidate(s).`);
