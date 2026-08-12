import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { extractStoryBundle, STORY_JSON_END, STORY_JSON_START } from "./lib/editorial.mjs";
import { cleanWhitespace, readJson } from "./lib/io.mjs";
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

function extractJson(text) {
  const cleaned = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try { return JSON.parse(cleaned); } catch {}
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first >= 0 && last > first) return JSON.parse(cleaned.slice(first, last + 1));
  throw new Error("Copilot response did not contain valid JSON.");
}

function chatPrompt(bundle, feedback = []) {
  const event = bundle.event;
  const sourceFacts = (bundle.ingestion?.sourceDigests || []).map((item) => `${item.publisher}: ${item.excerpt}`).join("\n");
  const failures = feedback.length ? `\nTHE PREVIOUS ATTEMPT FAILED\n- ${feedback.join("\n- ")}\nRewrite every line from scratch.` : "";
  return `Return ONLY valid JSON with keys messages, meme and reviewNotes. Rewrite only the imagined chat for this article; preserve the article exactly.

ARTICLE
Headline: ${event.article?.headline || event.title}
Dek: ${event.article?.dek || event.kicker}
Report: ${(event.article?.body || []).join("\n")}
Verified summary: ${event.summary}
Sources: ${(event.sources || []).map((source) => `${source.publisher}: ${source.label}`).join("\n")}
Source facts: ${sourceFacts || "No additional digest."}
${failures}

Write 10–14 messages that feel like an organic group chat among people or institutions naturally connected to this exact event. Start in the middle of a reaction—a position, challenge, contradiction, pointed question or joke. Use direct first-person replies, interruptions and callbacks; at least two speakers must return. Every line must respond to the actual people, act, number, place, object or consequence in this article.

Never write “I read [headline]”. Never paste, recite or lightly trim the article or source headline in a message. Never use “the verified event is pinned”, “fact pattern”, “reported detail”, “answer the file”, “on the record”, “official line is shorter than the consequence”, “spin requested a longer deadline” or other newsroom-process filler. Do not reuse a conversation skeleton with swapped speakers. Do not invent factual claims, quotations or private conduct. For victims, war, death or illness, aim satire at power, policy and messaging.

JSON shape:
{"messages":[{"speaker":"UN Admin","text":"event-specific opening that does not repeat the headline","kind":"system","reaction":""},{"speaker":"natural participant","text":"direct organic reply","kind":"satire","reaction":""}],"meme":"one original event-specific closing line","reviewNotes":"why this chat is unique to this article"}`;
}

function runCopilot(bundle, feedback = []) {
  const result = spawnSync("copilot", ["--yolo", "-p", chatPrompt(bundle, feedback)], {
    encoding: "utf8", timeout: 180000, maxBuffer: 2 * 1024 * 1024, env: process.env
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || `Copilot exited ${result.status}`);
  return extractJson(result.stdout);
}

function applyChat(bundle, output) {
  const result = structuredClone(bundle);
  if (!Array.isArray(output.messages)) throw new Error("Generated chat did not include messages.");
  result.event.messages = output.messages.map((message) => ({
    speaker: cleanWhitespace(message?.speaker).slice(0, 90),
    text: cleanWhitespace(message?.text).slice(0, 700),
    kind: message?.kind === "system" ? "system" : "satire",
    reaction: ""
  }));
  result.event.meme = cleanWhitespace(output.meme).slice(0, 280);
  result.approval = {
    ...(result.approval || {}),
    conversationStyle: "article-specific-direct-chat",
    targetMessageCount: "10-14",
    dialogueQuality: "original first-person exchanges generated for this article; article and sources preserved",
    dialogueRefinedAt: new Date().toISOString(),
    reviewNotes: `${result.approval?.reviewNotes || ""} ${cleanWhitespace(output.reviewNotes)}`.trim()
  };
  return result;
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

const published = await readJson(resolve(process.cwd(), "data/published-events.json"), []);
const openIssues = await github(`/repos/${repository}/issues?state=open&labels=news-candidate&per_page=100`);
const existingBundles = [
  ...published.map((event) => ({ event })),
  ...openIssues.filter((candidate) => !candidate.pull_request && candidate.number !== issueNumber).flatMap((candidate) => {
    try { return [extractStoryBundle(candidate.body || "")]; } catch { return []; }
  })
];

let feedback = ["The owner requested a completely new, organic article-specific conversation."];
let generated = null;
for (let attempt = 0; attempt < 3; attempt += 1) {
  try {
    const candidate = applyChat(bundle, runCopilot(bundle, attempt ? feedback : []));
    const candidateProblems = dialogueProblems(candidate, { existingBundles });
    if (!candidateProblems.length) { generated = candidate; break; }
    feedback = candidateProblems;
  } catch (error) {
    feedback = [error.message];
  }
}
if (!generated) {
  await setLabels(issue, ["needs-editor"], ["regenerate-requested", "drafting", "ready-for-approval"]);
  throw new Error(`Original chat generation failed quality checks: ${feedback.join(" | ")}`);
}
bundle = generated;

// A chat rewrite must never silently rewrite the already-reviewed article.
bundle.event.article = originalArticle;
bundle.event.title = originalTitle;
bundle.event.kicker = originalKicker;
bundle.event.category = originalCategory;
const problems = dialogueProblems(bundle, { existingBundles });
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
