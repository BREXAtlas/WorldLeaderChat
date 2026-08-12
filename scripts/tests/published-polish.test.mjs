import test from "node:test";
import assert from "node:assert/strict";
import { mergePublishedDuplicates } from "../lib/published-dedupe.mjs";
import { polishPublishedEvents, publishedPolishIds } from "../lib/published-polish.mjs";
import { dialogueProblems } from "../lib/chat-quality.mjs";

function source(label, publisher, suffix) {
  return { label, publisher, url: `https://example.com/${suffix}` };
}

function publishedEvent(id, issueNumber, title, summary, label) {
  return {
    id,
    eventDate: id.slice(0, 10),
    year: 2026,
    date: "August 10, 2026",
    title,
    kicker: "Old generic kicker",
    category: "World News",
    summary,
    article: {
      headline: label,
      dek: summary,
      body: [summary.repeat(2), summary.repeat(2)],
      sourceCredit: "Based on original reporting."
    },
    sources: [source(label, "Test News", String(issueNumber))],
    messages: [{ speaker: "Trump", text: "I have thoughts. Many people are saying they are excellent thoughts.", kind: "satire", reaction: "" }],
    meme: "Drake meme: old filler",
    tone: "comic",
    editorial: { issueNumber, reviewNotes: "Old review", singleSourceException: "A written source exception exists." }
  };
}

test("all known published problem files are covered by the polish pass", () => {
  for (const required of [
    "2026-08-10-francesca-hong-the-progressive-leading-a-messy-race-for-wisconsi",
    "2026-08-09-top-democrats-simulate-election-threats-as-trump-continues-assau",
    "2026-08-08-fifa-warns-of-effort-to-undermine-infantino-as-leadership-crisis",
    "2026-08-08-rest-assured-the-new-cdc-director-thinks-abortion-surveillance-i",
    "2026-08-08-president-xi-never-wastes-a-good-crisis-as-iran-ukraine-and-pale",
    "2026-08-07-one-of-science-fiction-s-greatest-writers-warned-us-about-a-ai-d",
    "2026-08-07-trump-imposes-15-tariff-on-key-chip-material-to-counter-china"
  ]) assert.ok(publishedPolishIds.includes(required), `missing published polish id ${required}`);
});

test("published polish replaces stock dialogue while preserving article and sources", () => {
  const original = publishedEvent(
    "2026-08-10-francesca-hong-the-progressive-leading-a-messy-race-for-wisconsi",
    76,
    "WORLD LEADERS OPENED THE NEWS",
    "Francesca Hong surged in the Wisconsin Democratic primary while party leaders debated electability.",
    "Francesca Hong leads a messy Wisconsin governor race"
  );
  const originalArticle = structuredClone(original.article);
  const originalSources = structuredClone(original.sources);
  const result = polishPublishedEvents([original]);
  assert.equal(result.changes.length, 1);
  const event = result.events[0];
  assert.match(event.title, /WISCONSIN/);
  assert.equal(event.messages.length, 10);
  assert.notEqual(event.messages[0].kind, "system");
  assert.notEqual(event.messages[0].speaker, "UN Admin");
  assert.equal(dialogueProblems({ event }).length, 0);
  assert.deepEqual(event.article, originalArticle);
  assert.deepEqual(event.sources, originalSources);
  assert.doesNotMatch(JSON.stringify(event.messages), /I have thoughts|strongest interpretation/i);
  assert.doesNotMatch(event.meme, /Drake/i);
});

test("Gaza-plan follow-ups merge into one source-rich canonical event", () => {
  const canonical = {
    id: "2026-08-09-israel-rejects-trump-s-15-point-plan-for-gaza",
    sources: [source("Canonical", "BBC News", "bbc")],
    editorial: { issueNumber: 22, reviewNotes: "Canonical", singleSourceException: "one" }
  };
  const duplicateIds = [
    ["2026-08-09-netanyahu-rejects-trump-backed-gaza-peace-plan", 63, "DW"],
    ["2026-08-09-netanyahu-rejects-trump-s-gaza-peace-plan-demands-hamas-disarm-f", 64, "NPR"],
    ["2026-08-10-netanyahu-rejects-us-backed-15-point-gaza-peace-plan-first-thing", 73, "The Guardian"]
  ];
  const duplicates = duplicateIds.map(([id, issueNumber, publisher]) => ({
    id,
    sources: [source(id, publisher, String(issueNumber))],
    editorial: { issueNumber, reviewNotes: publisher, singleSourceException: "one" }
  }));
  const result = mergePublishedDuplicates([canonical, ...duplicates]);
  assert.equal(result.events.length, 1);
  assert.equal(result.changes.length, 1);
  assert.equal(result.events[0].sources.length, 4);
  assert.deepEqual(result.events[0].editorial.mergedIssueNumbers, [22, 63, 64, 73]);
  assert.equal(result.events[0].editorial.singleSourceException, "");
});
