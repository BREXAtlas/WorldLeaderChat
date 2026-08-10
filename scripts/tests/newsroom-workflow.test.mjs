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

test("drafting prompt preserves factual conclusions and original credit", async () => {
  const draft = await read("scripts/draft-editorial-issues.mjs");
  assert.match(draft, /reader who opens the original links must reach the same factual conclusion/i);
  assert.match(draft, /Never invent an event, outcome, statistic, quotation, private communication, motive, meeting or source/);
  assert.match(draft, /Give credit to every listed publisher/);
  assert.match(draft, /10–14 chat messages/);
  assert.match(draft, /truth-first-sarcastic-news/);
});

test("future publication requires article-to-source verification", async () => {
  const validation = await read("scripts/lib/validation.mjs");
  assert.match(validation, /articleMatchesSources must be true/);
  assert.match(validation, /event\.article\.body must contain 2–6 short paragraphs/);
});
