import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("news ingestion runs four times daily, balances eight desks and drafts before approval", async () => {
  const workflow = await read(".github/workflows/news-ingestion.yml");
  assert.match(workflow, /cron: "17 \*\/6 \* \* \*"/);
  assert.match(workflow, /copilot-requests: write/);
  assert.match(workflow, /WLC_LOOKBACK_HOURS:.*168/);
  assert.match(workflow, /WLC_MINIMUM_SCORE:.*4/);
  assert.match(workflow, /WLC_MAX_CANDIDATES:.*20/);
  assert.match(workflow, /War & Security, World News, Politics & Society, Technology & AI, Science & Space, Business & Power, Culture & Entertainment, Sports & Soft Power/);
  assert.match(workflow, /draft-editorial-issues\.mjs/);
  assert.match(workflow, /refine-editorial-dialogue\.mjs/);
  assert.match(workflow, /Nothing publishes without owner approval/);
});

test("source configuration covers hard news and world-leader-adjacent desks", async () => {
  const config = JSON.parse(await read("config/news-sources.json"));
  const desks = new Set(config.sources.filter((source) => source.enabled).map((source) => source.desk));
  for (const required of [
    "World News",
    "US Politics & Society",
    "Technology & AI",
    "Science & Space",
    "Business & Power",
    "Culture & Entertainment",
    "Sports & Soft Power"
  ]) assert.ok(desks.has(required), `missing desk: ${required}`);
  assert.ok(config.maxCandidatesPerRun >= 12);
  assert.ok(config.relevance.adjacentPeopleTerms.includes("taylor swift"));
  assert.ok(config.relevance.adjacentPeopleTerms.includes("elon musk"));
});

test("drafting prompt preserves factual conclusions and forbids recycled stock chats", async () => {
  const entry = await read("scripts/draft-editorial-issues.mjs");
  const draft = await read("scripts/draft-editorial-issues-v2.mjs");
  assert.match(entry, /draft-editorial-issues-v2\.mjs/);
  assert.match(draft, /reader who opens the original links must reach the same factual conclusion/i);
  assert.match(draft, /Never invent an event, outcome, statistic, quotation, private communication, motive, meeting or source/);
  assert.match(draft, /Give credit to every listed publisher/);
  assert.match(draft, /10–14 messages/);
  assert.match(draft, /truth-first-sarcastic-news/);
  assert.match(draft, /strongest interpretation/);
  assert.match(draft, /Do not default to Trump, Macron, Meloni and Xi/);
  assert.match(draft, /Never mention Drake/);
  assert.match(draft, /dialogueProblems/);
});

test("future publication requires article-to-source and chat-quality verification", async () => {
  const validation = await read("scripts/lib/validation.mjs");
  const publish = await read("scripts/publish-from-issue.mjs");
  assert.match(validation, /articleMatchesSources must be true/);
  assert.match(validation, /event\.article\.body must contain 2–6 short paragraphs/);
  assert.match(validation, /Chat quality:/);
  assert.match(publish, /existingBundles: published\.map/);
});

test("regenerate action runs the server drafting engine for one issue", async () => {
  const workflow = await read(".github/workflows/editorial-regenerate.yml");
  assert.match(workflow, /github\.event\.label\.name == 'regenerate-requested'/);
  assert.match(workflow, /WLC_TARGET_ISSUE/);
  assert.match(workflow, /WLC_FORCE_REWRITE: "1"/);
  assert.match(workflow, /draft-editorial-issues\.mjs/);
  assert.match(workflow, /refine-editorial-dialogue\.mjs/);
});

test("failed publication unlocks the issue and successful publication clears active queue labels", async () => {
  const workflow = await read(".github/workflows/editorial-publish.yml");
  assert.match(workflow, /--remove-label ready-for-approval/);
  assert.match(workflow, /--add-label publication-failed/);
  assert.match(workflow, /--remove-label editorial-approved/);
  assert.match(workflow, /Retry Publish/);
});
