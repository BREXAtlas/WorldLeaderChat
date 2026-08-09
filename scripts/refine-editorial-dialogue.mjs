import { extractStoryBundle, STORY_JSON_END, STORY_JSON_START } from "./lib/editorial.mjs";
import { buildDirectDialogue, dialogueNeedsRefinement } from "./lib/newsroom-dialogue.mjs";

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const apiBase = process.env.GITHUB_API_URL || "https://api.github.com";
const limit = Number(process.env.WLC_REFINE_LIMIT || 50);
const repeatedDisclosure = /\b(the event is real|the poll is real|private replies are not|private reactions.*imagined|facts are sourced|fictional satire|sourced event)\b/i;

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

function openingFor(bundle) {
  const text = `${bundle?.event?.title || ""} ${bundle?.event?.summary || ""}`.toLowerCase();
  if (/election|poll|ballot/.test(text)) return "New thread: election confidence. The spreadsheet entered with notifications on.";
  if (/gaza|netanyahu|hamas/.test(text)) return "New thread: Gaza plan. Fifteen points entered; the conditions are already typing.";
  if (/houthi|saudi|refinery|oil/.test(text)) return "New thread: refinery attack claim. Oil prices joined before the second reply.";
  if (/iran|hormuz|tehran|nuclear/.test(text)) return "New thread: Iran file. The latest ‘final’ update has reopened the previous final update.";
  if (/ukraine|zelensky|russia|putin|kyiv/.test(text)) return "New thread: Ukraine security. The word ‘guarantee’ has requested legal counsel.";
  if (/rocket|spacex|blue origin|nasa|moon|mars/.test(text)) return "New thread: launch successful. National prestige has exceeded the listed payload.";
  if (/artificial intelligence|\bai\b|openai|sam altman/.test(text)) return "New thread: AI release. Every participant has declared themselves the responsible adult.";
  if (/taylor swift|music|song|copyright|tiktok/.test(text)) return "New thread: music rights. Copyright joined with counsel present.";
  if (/larry david|tan suit|obama/.test(text)) return "New thread: the tan-suit file has been reopened for television.";
  if (/consulate|diplomatic vacuum/.test(text)) return "New thread: five diplomatic posts are closing. Soft power is checking the lease.";
  return "New thread opened. The first confident reply arrived before the briefing finished loading.";
}

function hasRepeatedDisclosure(bundle) {
  return (bundle?.event?.messages || []).some((message) => message?.kind === "system" && repeatedDisclosure.test(String(message.text || "")));
}

function polishSystemLanguage(messages, bundle) {
  let openingReplaced = false;
  return messages.map((message) => {
    if (!openingReplaced && message?.kind === "system" && repeatedDisclosure.test(String(message.text || ""))) {
      openingReplaced = true;
      return { ...message, text: openingFor(bundle) };
    }
    return message;
  });
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
    const needsDialogue = dialogueNeedsRefinement(bundle);
    const needsDisclosurePolish = hasRepeatedDisclosure(bundle);
    if (!needsDialogue && !needsDisclosurePolish) continue;

    const messages = needsDialogue ? buildDirectDialogue(bundle) : bundle.event.messages;
    bundle.event.messages = polishSystemLanguage(messages, bundle);
    bundle.approval = {
      ...(bundle.approval || {}),
      conversationStyle: "direct-back-and-forth",
      targetMessageCount: "10-14",
      dialogueQuality: "first-person direct dialogue; no meta narration",
      disclosureStyle: "site-level disclosure; chat notes stay in-world",
      dialogueRefinedAt: new Date().toISOString(),
      reviewNotes: `${bundle.approval?.reviewNotes || ""} Dialogue quality pass keeps recurring-speaker exchanges direct and leaves disclosure to the site-level statement.`.trim()
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
