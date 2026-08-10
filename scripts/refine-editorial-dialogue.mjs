import { resolve } from "node:path";
import { extractStoryBundle, STORY_JSON_END, STORY_JSON_START } from "./lib/editorial.mjs";
import { readJson } from "./lib/io.mjs";
import { dialogueProblems, stockMemeDetected } from "./lib/chat-quality.mjs";
import { buildDirectDialogue, closingLineFor } from "./lib/newsroom-dialogue.mjs";

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const apiBase = process.env.GITHUB_API_URL || "https://api.github.com";
const limit = Number(process.env.WLC_REFINE_LIMIT || 50);
const targetIssue = Number(process.env.WLC_TARGET_ISSUE || 0);
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
  const headline = `${bundle?.event?.title || ""} ${bundle?.event?.article?.headline || ""} ${(bundle?.event?.sources || []).map((source) => source.label).join(" ")}`.toLowerCase();
  if (/gaza|netanyahu|hamas/.test(headline)) return "New thread: Gaza roadmap. Withdrawal and disarmament are arguing over which one comes first.";
  if (/houthi|saudi.*refinery|refinery.*saudi/.test(headline)) return "New thread: Saudi refinery attack claim. The new defense pact already has notifications.";
  if (/ahrq|patient safety|hospital patients safe/.test(headline)) return "New thread: patient-safety research. The checklist saved lives; the budget line is under review.";
  if (/gymnastics|frederick richard|fred richard/.test(headline)) return "New thread: Frederick Richard wins the national all-around title. Los Angeles 2028 is already typing.";
  if (/lisa cook|fed governor/.test(headline)) return "New thread: Fed independence and another Lisa Cook removal letter. The court ruling is still pinned.";
  if (/tariff.*refund|refund.*tariff|liberation day/.test(headline)) return "New thread: tariff refunds. Customs has the spreadsheet and the slogan has left the room.";
  if (/ukraine.*refiner|tatarstan|tyumen/.test(headline)) return "New thread: Ukrainian strikes on Russian oil facilities. The word pressure is visible in the smoke.";
  if (/election|poll|ballot/.test(headline)) return "New thread: election confidence. The spreadsheet entered with notifications on.";
  if (/rocket|spacex|blue origin|nasa|moon|mars/.test(headline)) return "New thread: space hardware. National prestige has exceeded the listed payload.";
  if (/artificial intelligence|\bai\b|openai|cybersecurity/.test(headline)) return "New thread: AI capability. Every participant has declared themselves the responsible adult.";
  return `New thread: ${String(bundle?.event?.article?.headline || bundle?.event?.title || "the latest development").replace(/\s+/g, " ").slice(0, 110)}.`;
}

function hasRepeatedDisclosure(bundle) {
  return (bundle?.event?.messages || []).some((message) => message?.kind === "system" && repeatedDisclosure.test(String(message.text || "")));
}

function polishSystemLanguage(messages, bundle) {
  let openingReplaced = false;
  return messages.map((message) => {
    if (!openingReplaced && message?.kind === "system" && repeatedDisclosure.test(String(message.text || ""))) {
      openingReplaced = true;
      return { ...message, text: openingFor(bundle), reaction: "" };
    }
    return { ...message, reaction: String(message?.reaction || "") };
  });
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

const issues = await github(`/repos/${repository}/issues?state=open&labels=news-candidate&per_page=100`);
const published = await readJson(resolve(process.cwd(), "data/published-events.json"), []);
const publishedBundles = published.map((event) => ({ event }));
const parsedOpen = issues
  .filter((issue) => !issue.pull_request)
  .map((issue) => {
    try { return { issue, bundle: extractStoryBundle(issue.body || "") }; }
    catch { return { issue, bundle: null }; }
  });

const queue = parsedOpen
  .filter(({ issue, bundle }) => bundle)
  .filter(({ issue }) => {
    const labels = labelsOf(issue);
    if (targetIssue && issue.number !== targetIssue) return false;
    return labels.has("ready-for-approval")
      && !labels.has("published")
      && !labels.has("editorial-approved")
      && !labels.has("rejected");
  })
  .slice(0, limit);

let checked = 0;
let refined = 0;
let blocked = 0;
const accepted = [...publishedBundles];
for (const { issue, bundle } of queue) {
  checked += 1;
  try {
    const otherOpen = parsedOpen
      .filter((item) => item.bundle && item.issue.number !== issue.number)
      .map((item) => item.bundle);
    const initialProblems = dialogueProblems(bundle, { existingBundles: [...accepted, ...otherOpen] });
    const needsDisclosurePolish = hasRepeatedDisclosure(bundle);
    const needsMemePolish = stockMemeDetected(bundle.event?.meme);
    if (!initialProblems.length && !needsDisclosurePolish && !needsMemePolish) {
      accepted.push(bundle);
      continue;
    }

    if (initialProblems.length) bundle.event.messages = buildDirectDialogue(bundle);
    bundle.event.messages = polishSystemLanguage(bundle.event.messages, bundle);
    if (needsMemePolish || initialProblems.length) bundle.event.meme = closingLineFor(bundle);

    bundle.approval = {
      ...(bundle.approval || {}),
      conversationStyle: "article-specific-direct-chat",
      targetMessageCount: "10-14",
      dialogueQuality: "unique first-person exchanges tied to this article; no meta narration or recycled stock lines",
      disclosureStyle: "site-level disclosure; chat notes stay in-world",
      dialogueRefinedAt: new Date().toISOString(),
      reviewNotes: `${bundle.approval?.reviewNotes || ""} Chat quality pass replaced recycled or mismatched dialogue with article-specific direct exchanges and an original closing line.`.trim()
    };

    const postProblems = dialogueProblems(bundle, { existingBundles: accepted });
    if (postProblems.length) {
      blocked += 1;
      await setLabels(issue, ["needs-editor"], ["ready-for-approval", "drafting", "regenerate-requested"]);
      console.error(`::warning title=Dialogue remains blocked::Issue #${issue.number}: ${postProblems.join(" | ")}`);
      continue;
    }

    await github(`/repos/${repository}/issues/${issue.number}`, {
      method: "PATCH",
      body: { body: replaceBundle(issue.body || "", bundle) }
    });
    await setLabels(issue, ["ready-for-approval"], ["drafting", "needs-editor", "regenerate-requested"]);
    accepted.push(bundle);
    refined += 1;
    console.log(`Refined unique article-specific conversation for issue #${issue.number}.`);
  } catch (error) {
    blocked += 1;
    console.error(`::warning title=Dialogue refinement failed::Issue #${issue.number}: ${error.message}`);
  }
}

console.log(`Dialogue refinement complete: ${refined} refined, ${blocked} blocked, ${checked} checked.`);
