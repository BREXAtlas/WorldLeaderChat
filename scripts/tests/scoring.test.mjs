import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { scoreStory } from "../lib/scoring.mjs";

const config = JSON.parse(await readFile(new URL("../../config/news-sources.json", import.meta.url), "utf8"));

test("world-leader crisis reporting scores above the editorial threshold", () => {
  const result = scoreStory({
    title: "Trump and Zelensky meet at NATO summit over Ukraine ceasefire",
    excerpt: "The president and prime minister discussed military aid and negotiations.",
    sourceWeight: 2,
    sourceDesk: "World News"
  }, config.relevance);
  assert.ok(result.score >= config.minimumScore, `score was ${result.score}`);
  assert.ok(result.matchedKeywords.includes("trump"));
  assert.equal(result.category, "War & Security");
});

test("world-leader-adjacent culture reporting qualifies without pretending it is war news", () => {
  const result = scoreStory({
    title: "Taylor Swift songs removed from Trump TikTok post after copyright dispute",
    excerpt: "The White House and the singer's team became part of a social media and copyright story.",
    sourceWeight: 1,
    sourceDesk: "Culture & Entertainment"
  }, config.relevance);
  assert.ok(result.score >= config.minimumScore, `score was ${result.score}`);
  assert.equal(result.category, "Culture & Entertainment");
  assert.ok(result.matchedKeywords.includes("taylor swift"));
  assert.ok(result.matchedKeywords.includes("trump"));
});

test("major private-space reporting qualifies for a world-leader-adjacent conversation", () => {
  const result = scoreStory({
    title: "SpaceX launches historic Mars mission as governments watch",
    excerpt: "Elon Musk's company launched a rocket while national space agencies tracked the mission.",
    sourceWeight: 2,
    sourceDesk: "Science & Space"
  }, config.relevance);
  assert.ok(result.score >= config.minimumScore, `score was ${result.score}`);
  assert.equal(result.category, "Science & Space");
});

test("low-value lifestyle content without public significance stays below threshold", () => {
  const result = scoreStory({
    title: "Weekly recipe, horoscope and shopping deals roundup",
    excerpt: "Coupon codes and lottery numbers for the weekend.",
    sourceWeight: 1,
    sourceDesk: "Culture & Entertainment"
  }, config.relevance);
  assert.ok(result.score < config.minimumScore, `score was ${result.score}`);
});
