import { spawnSync } from "node:child_process";
import { extractStoryBundle, STORY_JSON_END, STORY_JSON_START } from "./lib/editorial.mjs";
import { cleanWhitespace } from "./lib/io.mjs";

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const apiBase = process.env.GITHUB_API_URL || "https://api.github.com";
const limit = Number(process.env.WLC_DRAFT_LIMIT || 20);

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

function topicFlags(bundle) {
  const text = `${bundle.event?.title || ""} ${bundle.event?.summary || ""} ${(bundle.event?.sources || []).map((source) => source.label).join(" ")}`.toLowerCase();
  return {
    gaza: /gaza|netanyahu|hamas/.test(text),
    ukraine: /ukraine|zelensky|kyiv|russia|putin|serbia/.test(text),
    iran: /iran|hormuz|tehran|nuclear/.test(text),
    china: /china|xi|consulate|taiwan/.test(text),
    space: /rocket|spacex|blue origin|nasa|spacecraft|moon|mars|launch/.test(text),
    ai: /artificial intelligence|\bai\b|openai|sam altman|model|chip|semiconductor/.test(text),
    culture: /taylor swift|larry david|obama|music|song|album|film|television|hbo|copyright|tiktok/.test(text),
    immigration: /immigration|deportation|border|ice raid/.test(text),
    election: /election|midterm|poll|campaign|ballot/.test(text),
    sensitive: /killed|dead|death|hostage|missile|war|civilian|attack|disaster|gaza/.test(text)
  };
}

function headlineFor(bundle, flags) {
  const source = bundle.event?.sources?.[0]?.label || bundle.event?.title || "World news develops";
  if (flags.gaza) return "THE GAZA PLAN ARRIVES WITH 15 POINTS AND LEAVES WITH EVERYONE’S NOTES";
  if (flags.ukraine) return "EUROPE OPENS ANOTHER SECURITY CHAT; THE WORD ‘GUARANTEE’ STARTS BUFFERING";
  if (flags.iran) return "THE IRAN FILE GETS ANOTHER ‘FINAL’ UPDATE; THE CHAT SCROLLS UP FOR RECEIPTS";
  if (flags.space) return "THE ROCKET LEAVES EARTH; THE BILLIONAIRES IMMEDIATELY ARGUE ABOUT WHO LEFT BETTER";
  if (flags.ai) return "THE NEW AI ARRIVES; GOVERNMENTS ASK WHETHER THE TERMS OF SERVICE INCLUDE THEM";
  if (flags.culture && /obama|larry david|tan suit/i.test(source)) return "OBAMA REOPENS THE TAN-SUIT FILE; LARRY DAVID PLEADS COMEDIC IMMUNITY";
  if (flags.culture && /taylor swift|music|song/i.test(source)) return "TAYLOR’S SONGS LEAVE THE TRUMP FEED; THE WHITE HOUSE DISCOVERS SILENT MODE";
  if (flags.immigration) return "THE IMMIGRATION POLL LANDS; BOTH PARTIES HIGHLIGHT DIFFERENT NUMBERS IN BOLD";
  if (flags.election) return "THE NEW POLL DROPS; EVERY CAMPAIGN DECLARES ITS FAVORITE CROSSTAB THE REAL RESULT";
  return source.toUpperCase().replace(/\s+/g, " ").slice(0, 210);
}

function articleAngle(flags) {
  if (flags.gaza) return "The proposal is real; so is the disagreement. The satire lives in how quickly a numbered plan can become a shared document where every participant has edit access.";
  if (flags.ukraine) return "The facts point to another round of high-stakes security diplomacy. The dry reading is that every capital supports clarity right up until clarity asks for a commitment.";
  if (flags.iran) return "The underlying development is serious. The sharper angle is the familiar choreography: warnings called final, negotiations called possible and everyone keeping screenshots.";
  if (flags.space) return "The launch or discovery is the news. The comic subtext is that national prestige, private capital and billionaire rivalry rarely stay in separate group chats for long.";
  if (flags.ai) return "The technology is real and consequential. The satire comes from watching governments, founders and regulators simultaneously claim they are in control of it.";
  if (flags.culture) return "The cultural event is real. The political subtext is that presidents, campaigns and celebrities can turn a song, suit or television joke into a national briefing without scheduling one.";
  if (flags.immigration) return "The numbers are the news. The sarcastic angle is that every faction can find one statistic that sounds like the country finally agreed with it.";
  return "The event is reported straight. The edge comes from translating the public choreography into the subtext readers can already see.";
}

function participants(flags) {
  if (flags.gaza) return ["UN Admin", "Trump", "Netanyahu", "Macron", "Meloni", "Xi", "Trump", "Netanyahu", "Obama", "Macron", "UN Admin"];
  if (flags.ukraine) return ["UN Admin", "Zelenskyy", "Putin", "Meloni", "Trump", "Zelenskyy", "Macron", "Putin", "Xi", "Trump", "UN Admin"];
  if (flags.iran) return ["UN Admin", "Trump", "Iran", "Macron", "Putin", "Trump", "Iran", "Xi", "Vance", "Meloni", "UN Admin"];
  if (flags.space) return ["UN Admin", "Elon Musk", "Jeff Bezos", "Trump", "Xi", "Elon Musk", "Jeff Bezos", "NASA", "Macron", "Trump", "UN Admin"];
  if (flags.ai) return ["UN Admin", "Sam Altman", "Trump", "Xi", "Elon Musk", "Macron", "Sam Altman", "Vance", "Meloni", "Xi", "UN Admin"];
  if (flags.culture) return ["UN Admin", "Obama", "Trump", "Larry David", "Meloni", "Obama", "Trump", "Taylor Swift", "White House Comms", "Macron", "UN Admin"];
  if (flags.immigration) return ["UN Admin", "Trump", "Obama", "Vance", "AOC", "Trump", "Senate Staff", "Obama", "Meloni", "UN Admin"];
  return ["UN Admin", "Trump", "Macron", "Meloni", "Xi", "Trump", "Obama", "Milei", "Macron", "UN Admin"];
}

function lineFor(speaker, index, flags) {
  const topic = flags.space ? "launch" : flags.ai ? "AI announcement" : flags.culture ? "headline" : flags.immigration ? "poll" : flags.gaza ? "plan" : flags.ukraine ? "security guarantee" : flags.iran ? "final warning" : "development";
  const lines = {
    "UN Admin": index === 0
      ? `New thread: ${topic}. The event is real; the private reactions below are imagined from public personas.`
      : "Thread archived. The facts remained sourced. The confidence remained unsourced.",
    "Trump": index < 6
      ? `Very important ${topic}. I already have the strongest interpretation of it.`
      : `I checked the earlier messages. Mine still had the best engagement.`,
    "Obama": index < 7
      ? "We may want to separate the actual development from the cable-news personality test."
      : "I see the separation lasted approximately two messages.",
    "Macron": index < 6
      ? "Could we agree on the facts before competing over the dramatic interpretation?"
      : "The dramatic interpretation has once again defeated the agenda.",
    "Meloni": "Every international meeting eventually becomes a group project where the footnotes are fighting.",
    "Xi": index < 7
      ? "China is observing both the event and the speed with which everyone made it about themselves."
      : "The typing indicator remains more stable than the consensus.",
    "Milei": "I have a chainsaw metaphor ready, but apparently this thread already cut the context.",
    "Netanyahu": index < 7 ? "I read the proposal. Reading it is not the same as accepting its conditions." : "The numbering can stay. The conditions will not.",
    "Zelenskyy": index < 7 ? "I asked for a commitment, not another adjective describing concern." : "The adjective has now been upgraded. The commitment has not.",
    "Putin": index < 7 ? "Everyone prefers strategic ambiguity when it belongs to their own strategy." : "I notice clarity is again being requested from only one side.",
    "Iran": index < 7 ? "You called the previous warning final. We kept the screenshot." : "Please choose between negotiations and season-finale language.",
    "Vance": "The headline is clear. Verification is apparently requesting more time.",
    "Elon Musk": index < 7 ? "The engineering is the hard part. The posting is just mission control with replies enabled." : "For the record, reusable arguments are also more efficient.",
    "Jeff Bezos": index < 7 ? "Congratulations on the launch. We will compare altitude, payload and press-release adjectives later." : "I have added ‘humility’ to the next mission manifest. No payload mass listed.",
    "NASA": "The mission data are available. The billionaire subtweets are not part of the payload.",
    "Sam Altman": index < 7 ? "The model is capable. The governance conversation is still in beta." : "We have now benchmarked the model against eleven different definitions of regulation.",
    "Larry David": "I only touched one small detail and somehow it became a decade of political commentary.",
    "Taylor Swift": "My team has reviewed the usage. The silence you hear is the copyright holder speaking.",
    "White House Comms": "We were told the post tested well before the audio stopped testing at all.",
    "AOC": "Interesting how every poll becomes binding law when one number trends and ‘just a snapshot’ when another one does.",
    "Senate Staff": "We have circulated the crosstabs. No senator has opened the attachment, but several have reacted strongly."
  };
  return lines[speaker] || `I have reviewed the ${topic}. My public statement will be longer and less specific.`;
}

function deterministicDraft(bundle) {
  const result = structuredClone(bundle);
  const flags = topicFlags(result);
  const summary = safeSummary(result.event.summary);
  const sources = result.event.sources || [];
  const publishers = [...new Set(sources.map((source) => source.publisher).filter(Boolean))];
  const title = headlineFor(result, flags);
  const angle = articleAngle(flags);
  const people = participants(flags);

  result.ingestion.newsroomFormat = 2;
  result.event.title = title;
  result.event.kicker = angle;
  result.event.summary = summary;
  result.event.article = {
    headline: title,
    dek: angle,
    body: [
      summary,
      `The straight reading is the one in the original reporting: ${summary.charAt(0).toLowerCase()}${summary.slice(1)} The sharper reading is not a different event; it is the same event with the public choreography left visible.`,
      angle,
      `That is where the group chat enters. Its messages are imagined, but the pressure points are not: public positions, familiar rivalries and the gap between what leaders announce and what everyone suspects the room sounded like.`
    ],
    sourceCredit: `Based on and credited to original reporting from ${publishers.join(", ") || "the linked publisher"}. Follow the source links for the full reporting.`
  };
  result.event.messages = people.map((speaker, index) => ({
    speaker,
    text: lineFor(speaker, index, flags),
    kind: speaker === "UN Admin" ? "system" : "satire",
    reaction: ""
  }));
  result.event.meme = flags.space
    ? "UN Admin muted the billionaire comparison thread. It achieved orbit anyway."
    : flags.culture
      ? "The post kept the views. The soundtrack exercised its right to remain silent."
      : flags.immigration
        ? "Every campaign saved the same poll under a different filename."
        : "UN Admin changed the group description to: SAME FACTS, DIFFERENT VICTORY LAPS.";
  result.event.tone = flags.sensitive ? "sober" : "comic";
  result.approval = {
    ...(result.approval || {}),
    reviewNotes: "Truth-first newsroom draft: factual conclusion preserved; wit limited to framing and plausible private reactions; original sources retained.",
    articleStyle: "truth-first-sarcastic-news",
    conversationStyle: "back-and-forth",
    targetMessageCount: "10-14",
    draftVersion: Number(result.approval?.draftVersion || 0) + 1
  };
  return result;
}

function promptFor(bundle) {
  const sources = (bundle.event.sources || []).map((source, index) => `${index + 1}. ${source.publisher}: ${source.label} — ${source.url}`).join("\n");
  const digests = (bundle.ingestion.sourceDigests || []).map((item, index) => `${index + 1}. ${item.publisher}: ${item.excerpt}`).join("\n");
  return `You are the World Leader Chat newsroom editor. Return ONLY valid JSON, no markdown fences.

SOURCE-LOCKED FACTS
Date: ${bundle.event.date}
Category: ${bundle.event.category}
Verified RSS summary: ${safeSummary(bundle.event.summary)}
Sources:\n${sources}
Additional source digests:\n${digests || "None"}

Write a short, engaging news treatment of the SAME real event. The reader who opens the original links must reach the same factual conclusion.

Rules:
- Never invent an event, outcome, statistic, quotation, private communication, motive, meeting or source.
- Do not claim that an imagined chat actually occurred.
- Use dry sarcasm and sharp framing, not nonsense or fabricated facts.
- The article must read like real reporting with personality: 3–5 short paragraphs, 280–700 words total.
- Keep factual assertions within the supplied summary and source labels.
- Give credit to every listed publisher in sourceCredit.
- Create 10–14 chat messages with actual replies and recurring speakers, not isolated one-liners.
- Choose only people plausibly adjacent to this story: leaders, former leaders, lawmakers, officials, founders, artists or public figures mentioned or naturally connected.
- Messages are fictional reactions grounded in public persona and known public positions. Do not present them as quotations.
- On death, war, disaster or victims, target power, policy, propaganda and messaging—not victims.
- The headline should be time-sensitive, catchy, truthful and lightly sarcastic.
- No broad parody disclaimer inside the article. The site handles disclosure.

Return this exact JSON shape:
{
  "title": "...",
  "kicker": "...",
  "category": "...",
  "article": {
    "headline": "...",
    "dek": "...",
    "body": ["paragraph 1", "paragraph 2", "paragraph 3"],
    "sourceCredit": "Based on original reporting from ..."
  },
  "messages": [
    {"speaker":"UN Admin","text":"...","kind":"system","reaction":""},
    {"speaker":"Name","text":"...","kind":"satire","reaction":""}
  ],
  "meme": "...",
  "tone": "comic or sober",
  "reviewNotes": "one sentence explaining how factual fidelity was preserved"
}`;
}

function copilotDraft(bundle) {
  const result = spawnSync("copilot", ["--yolo", "-p", promptFor(bundle)], {
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
  if (output.messages.length < 10 || output.messages.length > 14) {
    throw new Error(`Copilot returned ${output.messages.length} messages; expected 10–14.`);
  }
  if (!output.messages.every((message) => ["system", "satire"].includes(message.kind))) {
    throw new Error("Copilot returned an unsupported message kind.");
  }
  return output;
}

function applyCopilot(bundle, output) {
  const result = structuredClone(bundle);
  result.ingestion.newsroomFormat = 2;
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
    kind: message.kind,
    reaction: cleanWhitespace(message.reaction || "").slice(0, 200)
  }));
  result.event.meme = cleanWhitespace(output.meme).slice(0, 220);
  result.event.tone = output.tone === "sober" ? "sober" : "comic";
  result.approval = {
    ...(result.approval || {}),
    reviewNotes: cleanWhitespace(output.reviewNotes).slice(0, 600),
    articleStyle: "truth-first-sarcastic-news",
    conversationStyle: "back-and-forth",
    targetMessageCount: "10-14",
    draftVersion: Number(result.approval?.draftVersion || 0) + 1
  };
  return result;
}

const labelDefinitions = [
  { name: "drafting", color: "1d76db", description: "Article and chat are being drafted" },
  { name: "ready-for-approval", color: "0e8a16", description: "Completed article and chat are ready for owner review" }
];

async function ensureLabels() {
  const existing = await github(`/repos/${repository}/labels?per_page=100`);
  const names = new Set(existing.map((label) => label.name));
  for (const definition of labelDefinitions) {
    if (!names.has(definition.name)) await github(`/repos/${repository}/labels`, { method: "POST", body: definition });
  }
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

await ensureLabels();
const issues = await github(`/repos/${repository}/issues?state=open&labels=news-candidate&per_page=100`);
const queue = issues
  .filter((issue) => !issue.pull_request)
  .filter((issue) => {
    const labels = labelsOf(issue);
    return !labels.has("published") && !labels.has("editorial-approved") && !labels.has("rejected");
  })
  .slice(0, limit);

let drafted = 0;
let fallbackCount = 0;
for (const issue of queue) {
  try {
    let bundle = extractStoryBundle(issue.body || "");
    const alreadyComplete = Number(bundle.ingestion?.newsroomFormat || 0) >= 2
      && bundle.event?.article?.body?.length >= 2
      && bundle.event?.messages?.length >= 10
      && !JSON.stringify(bundle).includes("[EDITOR:");
    if (alreadyComplete) continue;

    await setLabels(issue, ["drafting"], ["needs-editor", "ready-for-approval"]);
    try {
      bundle = applyCopilot(bundle, copilotDraft(bundle));
    } catch (error) {
      fallbackCount += 1;
      console.error(`::warning title=Copilot draft fallback::Issue #${issue.number}: ${error.message}`);
      bundle = deterministicDraft(bundle);
    }

    const body = replaceBundle(issue.body || "", bundle);
    const updated = await github(`/repos/${repository}/issues/${issue.number}`, {
      method: "PATCH",
      body: { body }
    });
    await setLabels(updated, ["ready-for-approval"], ["drafting", "needs-editor"]);
    drafted += 1;
    console.log(`Drafted newsroom article and chat for issue #${issue.number}.`);
  } catch (error) {
    console.error(`::warning title=Editorial draft failed::Issue #${issue.number}: ${error.message}`);
  }
}

console.log(`Editorial drafting complete: ${drafted} ready, ${fallbackCount} deterministic fallback(s).`);
