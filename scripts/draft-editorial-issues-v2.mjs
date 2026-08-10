import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { extractStoryBundle, STORY_JSON_END, STORY_JSON_START } from "./lib/editorial.mjs";
import { cleanWhitespace, readJson } from "./lib/io.mjs";
import { dialogueProblems, stockMemeDetected } from "./lib/chat-quality.mjs";
import { buildDirectDialogue, closingLineFor } from "./lib/newsroom-dialogue.mjs";

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const apiBase = process.env.GITHUB_API_URL || "https://api.github.com";
const limit = Number(process.env.WLC_DRAFT_LIMIT || 20);
const targetIssue = Number(process.env.WLC_TARGET_ISSUE || 0);
const forceRewrite = process.env.WLC_FORCE_REWRITE === "1";

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

function safeSummary(value) {
  return cleanWhitespace(value)
    .replace(/\bContinue reading\.?$/i, "")
    .replace(/\bFollow [A-Z][A-Za-z .'-]+ for more\.?$/i, "")
    .slice(0, 1200);
}

function extractJson(text) {
  const cleaned = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try { return JSON.parse(cleaned); } catch {}
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first >= 0 && last > first) return JSON.parse(cleaned.slice(first, last + 1));
  throw new Error("Copilot response did not contain valid JSON.");
}

function promptFor(bundle, feedback = []) {
  const sources = (bundle.event.sources || [])
    .map((source, index) => `${index + 1}. ${source.publisher}: ${source.label} — ${source.url}`)
    .join("\n");
  const digests = (bundle.ingestion.sourceDigests || [])
    .map((item, index) => `${index + 1}. ${item.publisher}: ${item.excerpt}`)
    .join("\n");
  const prior = feedback.length ? `\nTHE LAST DRAFT FAILED FOR THESE REASONS\n- ${feedback.join("\n- ")}\nRewrite it completely; do not patch the failed lines.` : "";

  return `You are the World Leader Chat newsroom editor. Return ONLY valid JSON, no markdown fences.

SOURCE-LOCKED FACTS
Date: ${bundle.event.date}
Category: ${bundle.event.category}
Verified RSS summary: ${safeSummary(bundle.event.summary)}
Sources:\n${sources}
Additional source digests:\n${digests || "None"}
${prior}

Write a short, engaging treatment of the SAME real event. A reader who opens the original links must reach the same factual conclusion.

ARTICLE RULES
- Never invent an event, outcome, statistic, quotation, private communication, motive, meeting or source.
- Use dry sarcasm and sharp framing, not nonsense or unsupported certainty.
- Write 3–5 short paragraphs. Give credit to every listed publisher.
- The headline must identify this specific event; never use a generic headline that could fit another article.

CHAT RULES — THESE ARE STRICT
- Create 10–14 messages that sound like people texting each other, with replies, interruptions and callbacks.
- Every line must be unique to THIS article and mention or respond to its actual people, decision, number, place, object or consequence.
- At least two speakers must return later. Never place the same speaker in consecutive turns.
- A speaker's text must be direct first-person dialogue. Never write narration such as “frames the stance”, “signals irritation”, “calls for”, “notes”, “observes”, “emphasizes”, “suggests”, “underlines”, “sees” or “warns”.
- Do not recycle stock lines about “the strongest interpretation”, “I have thoughts”, “the facts are doing well”, “the personality test”, “the agenda”, “typing indicators” or changing the group name.
- Do not default to Trump, Macron, Meloni and Xi for unrelated stories. At least half the participants must be people or institutions naturally adjacent to this event.
- If a person's identity is uncertain, use a real institution such as Team USA, AHRQ, U.S. Customs or the Fed Board rather than inventing an officeholder.
- Do not copy any dialogue sample from prior World Leader Chat files.
- The final system message must close the specific joke or tension in this article.
- For death, war, disaster or victims, target power, policy, propaganda and messaging—not victims.

CLOSING-LINE RULE
- The field named meme is an original one-sentence punch line, not a stock-image meme description.
- Never mention Drake, Distracted Boyfriend, Two Buttons, Change My Mind or any named meme template unless that person is genuinely the subject of the source article.

Return this exact JSON shape:
{
  "title": "specific truthful lightly sarcastic headline",
  "kicker": "specific event angle",
  "category": "news desk",
  "article": {
    "headline": "specific article headline",
    "dek": "specific dek",
    "body": ["paragraph 1", "paragraph 2", "paragraph 3"],
    "sourceCredit": "Based on original reporting from every listed publisher"
  },
  "messages": [
    {"speaker":"UN Admin","text":"event-specific opening","kind":"system","reaction":""},
    {"speaker":"Name or institution","text":"direct first-person reply","kind":"satire","reaction":""}
  ],
  "meme": "original event-specific one-sentence punch line",
  "tone": "comic or sober",
  "reviewNotes": "one sentence explaining factual fidelity and chat specificity"
}`;
}

function runCopilot(bundle, feedback = []) {
  const result = spawnSync("copilot", ["--yolo", "-p", promptFor(bundle, feedback)], {
    encoding: "utf8",
    timeout: 180000,
    maxBuffer: 2 * 1024 * 1024,
    env: process.env
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || `Copilot exited ${result.status}`);
  const output = extractJson(result.stdout);
  if (!output.article || !Array.isArray(output.article.body) || !Array.isArray(output.messages)) {
    throw new Error("Copilot JSON is missing article or messages.");
  }
  return output;
}

function applyCopilot(bundle, output) {
  const result = structuredClone(bundle);
  result.ingestion = { ...(result.ingestion || {}), newsroomFormat: 2 };
  result.event.summary = safeSummary(result.event.summary);
  result.event.title = cleanWhitespace(output.title).slice(0, 240);
  result.event.kicker = cleanWhitespace(output.kicker).slice(0, 320);
  result.event.category = cleanWhitespace(output.category || result.event.category).slice(0, 80);
  result.event.article = {
    headline: cleanWhitespace(output.article.headline).slice(0, 240),
    dek: cleanWhitespace(output.article.dek).slice(0, 420),
    body: output.article.body.slice(0, 6).map((paragraph) => cleanWhitespace(paragraph).slice(0, 1400)),
    sourceCredit: cleanWhitespace(output.article.sourceCredit).slice(0, 500)
  };
  result.event.messages = output.messages.map((message) => ({
    speaker: cleanWhitespace(message.speaker).slice(0, 100),
    text: cleanWhitespace(message.text).slice(0, 600),
    kind: message.kind === "system" ? "system" : "satire",
    reaction: ""
  }));
  result.event.meme = cleanWhitespace(output.meme).slice(0, 220);
  result.event.tone = output.tone === "sober" ? "sober" : "comic";
  result.approval = {
    ...(result.approval || {}),
    reviewNotes: cleanWhitespace(output.reviewNotes).slice(0, 600),
    articleStyle: "truth-first-sarcastic-news",
    conversationStyle: "article-specific-direct-chat",
    targetMessageCount: "10-14",
    dialogueQuality: "unique first-person exchanges tied to this article; no stock lines or meta narration",
    draftVersion: Number(result.approval?.draftVersion || 0) + 1,
    dialogueRefinedAt: new Date().toISOString()
  };
  return result;
}

function ensureArticle(bundle) {
  const result = structuredClone(bundle);
  const current = result.event?.article;
  if (current?.body?.length >= 2) return result;
  const summary = safeSummary(result.event.summary);
  const publishers = [...new Set((result.event.sources || []).map((source) => source.publisher).filter(Boolean))];
  const headline = cleanWhitespace(result.event.sources?.[0]?.label || result.event.title).slice(0, 240);
  result.ingestion = { ...(result.ingestion || {}), newsroomFormat: 2 };
  result.event.summary = summary;
  result.event.title = headline;
  result.event.kicker = `The reported event is ${headline.toLowerCase()}; the sharper angle is who owns the consequence once the announcement leaves the podium.`.slice(0, 320);
  result.event.article = {
    headline,
    dek: result.event.kicker,
    body: [
      summary,
      `The original reporting establishes the event, chronology and immediate consequence. This version keeps those facts intact while making the public tension easier to read: who is claiming control, who is objecting and which official phrase is carrying more confidence than detail.`,
      `The source record remains the authority. The conversation below is an imagined exchange built around the people, institutions and pressure points directly connected to this report.`
    ],
    sourceCredit: `Based on original reporting from ${publishers.join(", ") || "the linked publisher"}.`
  };
  return result;
}

function deterministicDraft(bundle) {
  const result = ensureArticle(bundle);
  result.event.messages = buildDirectDialogue(result);
  result.event.meme = closingLineFor(result);
  const sensitive = /killed|dead|death|hostage|missile|war|civilian|attack|disaster|gaza/i.test(`${result.event.title} ${result.event.summary}`);
  result.event.tone = sensitive ? "sober" : "comic";
  result.approval = {
    ...(result.approval || {}),
    reviewNotes: `${result.approval?.reviewNotes || ""} Deterministic safety draft used article-specific participants, facts and direct replies; no stock dialogue or named meme template.`.trim(),
    articleStyle: "truth-first-sarcastic-news",
    conversationStyle: "article-specific-direct-chat",
    targetMessageCount: "10-14",
    dialogueQuality: "unique first-person exchanges tied to this article; no stock lines or meta narration",
    draftVersion: Number(result.approval?.draftVersion || 0) + 1,
    dialogueRefinedAt: new Date().toISOString()
  };
  return result;
}

async function setLabels(issue, additions = [], removals = []) {
  const labels = labelsOf(issue);
  additions.forEach((label) => labels.add(label));
  removals.forEach((label) => labels.delete(label));
  await github(`/repos/${repository}/issues/${issue.number}`, {
    method: "PATCH",
    body: { labels: [...labels] }
  });
}

const labelDefinitions = [
  { name: "drafting", color: "1d76db", description: "Article and chat are being drafted" },
  { name: "ready-for-approval", color: "0e8a16", description: "Completed article and chat are ready for owner review" },
  { name: "regenerate-requested", color: "fbca04", description: "Owner requested a completely new article-specific chat" },
  { name: "needs-editor", color: "d93f0b", description: "Draft failed automated chat-quality safeguards" }
];

async function ensureLabels() {
  const existing = await github(`/repos/${repository}/labels?per_page=100`);
  const names = new Set(existing.map((label) => label.name));
  for (const definition of labelDefinitions) {
    if (!names.has(definition.name)) await github(`/repos/${repository}/labels`, { method: "POST", body: definition });
  }
}

await ensureLabels();
const issues = await github(`/repos/${repository}/issues?state=open&labels=news-candidate&per_page=100`);
const published = await readJson(resolve(process.cwd(), "data/published-events.json"), []);
const acceptedBundles = published.map((event) => ({ event }));
const parsed = issues
  .filter((issue) => !issue.pull_request)
  .map((issue) => {
    try { return { issue, bundle: extractStoryBundle(issue.body || "") }; }
    catch { return { issue, bundle: null }; }
  });

const queue = parsed
  .filter(({ issue, bundle }) => bundle)
  .filter(({ issue }) => {
    const labels = labelsOf(issue);
    if (targetIssue && issue.number !== targetIssue) return false;
    return !labels.has("published") && !labels.has("editorial-approved") && !labels.has("rejected");
  })
  .filter(({ issue, bundle }) => {
    const labels = labelsOf(issue);
    const complete = Number(bundle.ingestion?.newsroomFormat || 0) >= 2
      && bundle.event?.article?.body?.length >= 2
      && bundle.event?.messages?.length >= 10
      && !JSON.stringify(bundle).includes("[EDITOR:");
    const problems = complete ? dialogueProblems(bundle, { existingBundles: acceptedBundles }) : ["Draft is incomplete."];
    return forceRewrite || labels.has("regenerate-requested") || !complete || problems.length > 0 || stockMemeDetected(bundle.event?.meme);
  })
  .slice(0, limit);

let drafted = 0;
let fallbackCount = 0;
let blocked = 0;
for (const { issue, bundle: originalBundle } of queue) {
  try {
    await setLabels(issue, ["drafting"], ["needs-editor", "ready-for-approval"]);
    let bundle = originalBundle;
    let lastProblems = ["A new article-specific draft was requested."];
    let copilotWorked = false;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const candidate = applyCopilot(bundle, runCopilot(bundle, attempt ? lastProblems : []));
        const problems = dialogueProblems(candidate, { existingBundles: acceptedBundles });
        if (problems.length || stockMemeDetected(candidate.event?.meme)) {
          lastProblems = [...problems, ...(stockMemeDetected(candidate.event?.meme) ? ["The closing line used a named stock meme."] : [])];
          continue;
        }
        bundle = candidate;
        copilotWorked = true;
        break;
      } catch (error) {
        lastProblems = [error.message];
      }
    }

    if (!copilotWorked) {
      fallbackCount += 1;
      bundle = deterministicDraft(bundle);
    }

    const finalProblems = dialogueProblems(bundle, { existingBundles: acceptedBundles });
    if (finalProblems.length || stockMemeDetected(bundle.event?.meme)) {
      blocked += 1;
      await setLabels(issue, ["needs-editor"], ["drafting", "ready-for-approval", "regenerate-requested"]);
      console.error(`::warning title=Draft blocked by chat quality::Issue #${issue.number}: ${[...finalProblems, ...(stockMemeDetected(bundle.event?.meme) ? ["stock meme"] : [])].join(" | ")}`);
      continue;
    }

    const body = replaceBundle(issue.body || "", bundle);
    const updated = await github(`/repos/${repository}/issues/${issue.number}`, {
      method: "PATCH",
      body: { body }
    });
    await setLabels(updated, ["ready-for-approval"], ["drafting", "needs-editor", "regenerate-requested"]);
    acceptedBundles.push(bundle);
    drafted += 1;
    console.log(`Drafted unique article-specific chat for issue #${issue.number}.`);
  } catch (error) {
    blocked += 1;
    await setLabels(issue, ["needs-editor"], ["drafting", "ready-for-approval", "regenerate-requested"]).catch(() => {});
    console.error(`::warning title=Editorial draft failed::Issue #${issue.number}: ${error.message}`);
  }
}

console.log(`Editorial drafting complete: ${drafted} ready, ${fallbackCount} deterministic fallback(s), ${blocked} blocked.`);
