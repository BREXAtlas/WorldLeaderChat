import { resolve } from "node:path";
import { extractStoryBundle, STORY_JSON_END, STORY_JSON_START } from "./lib/editorial.mjs";
import { cleanWhitespace, readJson } from "./lib/io.mjs";
import { dialogueProblems, stockMemeDetected } from "./lib/chat-quality.mjs";
import { articleProblems, expectedSourceCredit, normalizeArticle } from "./lib/article-standard.mjs";
import { articleOnlySchema, chatPlanSchema, messagesFromChatPlan, runNewsroomJson } from "./lib/newsroom-model.mjs";

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const apiBase = process.env.GITHUB_API_URL || "https://api.github.com";
const limit = Number(process.env.WLC_DRAFT_LIMIT || 20);
const targetIssue = Number(process.env.WLC_TARGET_ISSUE || 0);
const forceRewrite = process.env.WLC_FORCE_REWRITE === "1";
const todayOnly = process.env.WLC_TODAY_ONLY === "1" || process.env.WLC_TODAY_ONLY === "true";
const maximumAttempts = Number(process.env.WLC_MAX_ATTEMPTS || (targetIssue ? 5 : 3));

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
- Write a complete 3–5 paragraph short report totaling roughly 140–300 words.
- Paragraph 1 says what happened. Paragraph 2 extracts the main facts and consequence. Paragraph 3 explains the political, cultural, business or strategic tension that makes the imagined chat worth reading. Use a fourth paragraph only when the source supports useful context.
- The prose should feel like World Leader Chat reporting the real news from a sharper angle: factual first, dry humor in the framing, never fabricated detail.
- Do not paste a feed excerpt, add a source-credit line as an article paragraph or end with “Continue reading.”
- Use only the facts present in the verified summary, listed source material and additional source digests. Do not name an unlisted publisher.
- Give credit to every listed publisher in sourceCredit and to no publisher that is not linked in the file.
- Keep category exactly "${bundle.ingestion?.newsroomDesk || bundle.event.category}"; the public desk taxonomy is editorial metadata, not creative copy.
- The headline must identify this specific event; never use a generic headline that could fit another article.

CHAT RULES — THESE ARE STRICT
- Create 10–14 messages that sound like people texting each other, with replies, interruptions and callbacks. Keep every message concise at 10–35 words.
- Every line must be unique to THIS article and mention or respond to its actual people, decision, number, place, object or consequence.
- Start in the middle of the reaction: a position, challenge, joke, contradiction or pointed question. Never write “I read [headline]”.
- The first message must come from a person or institution directly involved in the event. Never open with UN Admin, Admin, a narrator or a system message.
- Never paste, recite or lightly trim the article headline or source headline inside a message. People discuss what happened; they do not read headlines to one another.
- Do not use newsroom-process filler such as “the verified event is pinned”, “fact pattern”, “reported detail”, “answer the file”, “on the record”, “official line is shorter than the consequence” or “spin requested a longer deadline”.
- Before writing the messages, choose only 3–5 real people or institutions naturally connected to this event. Every chosen speaker must appear at least twice.
- Alternate those speakers throughout the chat. Never place the same speaker in consecutive turns, and never introduce a one-line speaker who does not return.
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
    {"speaker":"Name or institution directly involved","text":"direct first-person opening position","kind":"satire","reaction":""},
    {"speaker":"Another involved person or institution","text":"direct first-person reply","kind":"satire","reaction":""}
  ],
  "meme": "original event-specific one-sentence punch line",
  "tone": "comic or sober",
  "reviewNotes": "one sentence explaining factual fidelity and chat specificity"
}

The two message objects above show the field structure only. Your returned messages array MUST contain 10–14 complete, original message objects. A two-message array is invalid.`;
}

async function runWriter(bundle, feedback = [], acceptedArticleOutput = null) {
  const articlePrompt = `${promptFor(bundle, feedback).split("CHAT RULES — THESE ARE STRICT")[0]}
Return only this JSON object: {"title":"specific truthful headline","kicker":"event angle","category":"${bundle.ingestion?.newsroomDesk || bundle.event.category}","article":{"headline":"specific factual headline","dek":"factual deck","body":["paragraph 1","paragraph 2","paragraph 3"],"sourceCredit":"credit every listed publisher"},"reviewNotes":"factual fidelity note"}`;
  const articleOutput = acceptedArticleOutput
    || await runNewsroomJson(articlePrompt, { schema: articleOnlySchema, maxTokens: 1100, temperature: 0.4 });
  const chatPrompt = `Return only valid JSON with speakers, turns, meme and reviewNotes.

SOURCE-LOCKED ARTICLE
Headline: ${articleOutput.article?.headline}
Dek: ${articleOutput.article?.dek}
Report: ${(articleOutput.article?.body || []).join("\n")}
Verified summary: ${safeSummary(bundle.event.summary)}
Source facts: ${(bundle.ingestion?.sourceDigests || []).map((item) => `${item.publisher}: ${item.excerpt}`).join("\n") || "None"}
${feedback.length ? `Previous chat failures:\n- ${feedback.join("\n- ")}` : ""}

Choose exactly three distinct, specific people, companies, agencies, teams or organizations named in or directly responsible for this event. Do not choose Admin, UN Admin, World Leader, an analyst, expert, observer, narrator or other generic role. Put those names in speakers in the order they enter the chat.

Write exactly twelve concise, original turns in turns. Turn 1 is spoken by speakers[0], turn 2 by speakers[1], turn 3 by speakers[2], then repeat that same rotation four times. Write every turn in that speaker's direct first-person voice so the rotation reads as an actual exchange with replies, interruptions and callbacks. Start with a position, challenge or pointed question, not narration. Never write “I read [headline]”, recite the headline, invent facts or quotations, or use newsroom-process filler. Every turn must depend on this event's actual person, decision, number, place, object or consequence.`;
  const chatPlan = await runNewsroomJson(chatPrompt, { schema: chatPlanSchema, maxTokens: 1100, temperature: 0.7 });
  const chatOutput = { ...chatPlan, messages: messagesFromChatPlan(chatPlan) };
  const output = {
    ...articleOutput,
    ...chatOutput,
    tone: "comic",
    reviewNotes: `${articleOutput.reviewNotes || ""} ${chatOutput.reviewNotes || ""}`.trim()
  };
  if (!output.article || !Array.isArray(output.article.body) || !Array.isArray(output.messages)) {
    throw new Error("Local writer JSON is missing article or messages.");
  }
  return { output, articleOutput };
}

function applyGeneratedDraft(bundle, output) {
  const result = structuredClone(bundle);
  result.ingestion = { ...(result.ingestion || {}), newsroomFormat: 2 };
  result.event.summary = safeSummary(result.event.summary);
  result.event.title = cleanWhitespace(output.title).slice(0, 240);
  result.event.kicker = cleanWhitespace(output.kicker).slice(0, 320);
  result.event.category = cleanWhitespace(result.ingestion?.newsroomDesk || result.event.category || "World News").slice(0, 80);
  result.event.article = {
    headline: cleanWhitespace(output.article.headline).slice(0, 240),
    dek: cleanWhitespace(output.article.dek).slice(0, 420),
    body: output.article.body.slice(0, globalThis.WLC_NEWSROOM_CONTRACT.article.maximumParagraphs).map((paragraph) => cleanWhitespace(paragraph).slice(0, 1400)),
    sourceCredit: expectedSourceCredit(result.event.sources)
  };
  result.event.article = normalizeArticle(result.event.article, result.event.sources);
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
  { name: "redraft-requested", color: "d4c5f9", description: "Owner requested a new source-locked article and chat" },
  { name: "needs-editor", color: "d93f0b", description: "Automated newsroom draft is being corrected before owner review" }
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

function chicagoDateKey(value = Date.now()) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

const newsroomToday = chicagoDateKey();

const queue = parsed
  .filter(({ issue, bundle }) => bundle)
  .filter(({ bundle }) => !todayOnly || bundle.event?.eventDate === newsroomToday)
  .filter(({ issue }) => {
    const labels = labelsOf(issue);
    if (targetIssue && issue.number !== targetIssue) return false;
    return !labels.has("published") && !labels.has("editorial-approved") && !labels.has("rejected") && !labels.has("daily-overflow");
  })
  .filter(({ issue, bundle }) => {
    const labels = labelsOf(issue);
    const complete = Number(bundle.ingestion?.newsroomFormat || 0) >= 2
      && !articleProblems(bundle.event?.article, bundle.event?.sources).length
      && bundle.event?.messages?.length >= 10
      && !JSON.stringify(bundle).includes("[EDITOR:");
    const problems = complete
      ? [...articleProblems(bundle.event?.article, bundle.event?.sources), ...dialogueProblems(bundle, { existingBundles: acceptedBundles })]
      : ["Draft is incomplete."];
    return forceRewrite || labels.has("regenerate-requested") || labels.has("redraft-requested") || !complete || problems.length > 0 || stockMemeDetected(bundle.event?.meme);
  })
  .slice(0, limit);

let drafted = 0;
let generationFailureCount = 0;
let blocked = 0;
for (const { issue, bundle: originalBundle } of queue) {
  try {
    await setLabels(issue, ["drafting"], ["needs-editor", "ready-for-approval"]);
    let bundle = originalBundle;
    let lastProblems = ["A new article-specific draft was requested."];
    let writerWorked = false;
    let acceptedArticleOutput = null;
    let bestArticleCandidate = null;
    let bestProblemCount = Number.POSITIVE_INFINITY;

    for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
      try {
        const generated = await runWriter(bundle, attempt ? lastProblems : [], acceptedArticleOutput);
        const candidate = applyGeneratedDraft(bundle, generated.output);
        const candidateArticleProblems = articleProblems(candidate.event?.article, candidate.event?.sources);
        acceptedArticleOutput = candidateArticleProblems.length ? null : generated.articleOutput;
        const problems = [
          ...candidateArticleProblems.map((problem) => `Article: ${problem}`),
          ...dialogueProblems(candidate, { existingBundles: acceptedBundles })
        ];
        if (!candidateArticleProblems.length && problems.length < bestProblemCount) {
          bestArticleCandidate = candidate;
          bestProblemCount = problems.length;
        }
        if (problems.length || stockMemeDetected(candidate.event?.meme)) {
          lastProblems = [...problems, ...(stockMemeDetected(candidate.event?.meme) ? ["The closing line used a named stock meme."] : [])];
          continue;
        }
        bundle = candidate;
        writerWorked = true;
        break;
      } catch (error) {
        lastProblems = [error.message];
      }
    }

    if (!writerWorked) {
      generationFailureCount += 1;
      // Never promote fill-in-the-headline copy as a safety fallback. Keep the best
      // attempt in memory for diagnostics, but do not save a failed draft to the issue.
      bundle = bestArticleCandidate || bundle;
    }

    const finalProblems = [
      ...articleProblems(bundle.event?.article, bundle.event?.sources).map((problem) => `Article: ${problem}`),
      ...dialogueProblems(bundle, { existingBundles: acceptedBundles })
    ];
    if (finalProblems.length || stockMemeDetected(bundle.event?.meme)) {
      blocked += 1;
      await setLabels(issue, ["needs-editor"], ["drafting", "ready-for-approval", "regenerate-requested", "redraft-requested"]);
      console.error(`::warning title=Draft blocked by chat quality::Issue #${issue.number}: ${[...lastProblems.map((problem) => `Generation: ${problem}`), ...finalProblems, ...(stockMemeDetected(bundle.event?.meme) ? ["stock meme"] : [])].join(" | ")}`);
      continue;
    }

    const body = replaceBundle(issue.body || "", bundle);
    const updated = await github(`/repos/${repository}/issues/${issue.number}`, {
      method: "PATCH",
      body: { body }
    });
    await setLabels(updated, ["ready-for-approval"], ["drafting", "needs-editor", "regenerate-requested", "redraft-requested"]);
    acceptedBundles.push(bundle);
    drafted += 1;
    console.log(`Drafted unique article-specific chat for issue #${issue.number}.`);
  } catch (error) {
    blocked += 1;
    await setLabels(issue, ["needs-editor"], ["drafting", "ready-for-approval", "regenerate-requested", "redraft-requested"]).catch(() => {});
    console.error(`::warning title=Editorial draft failed::Issue #${issue.number}: ${error.message}`);
  }
}

console.log(`Editorial drafting complete: ${drafted} ready, ${generationFailureCount} generation failure(s) kept out of review, ${blocked} blocked.`);
if (targetIssue && blocked) process.exitCode = 1;
