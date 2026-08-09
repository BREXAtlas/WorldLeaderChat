import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { scoreStory } from "../lib/scoring.mjs";

const config = JSON.parse(await readFile(new URL("../../config/news-sources.json", import.meta.url), "utf8"));

test("world-leader crisis reporting scores above the editorial threshold", () => {
  const result = scoreStory({
    title: "Trump and Zelensky meet at NATO summit over Ukraine ceasefire",
    excerpt: "The president and prime minister discussed military aid and negotiations.",
    sourceWeight: 2
  }, config.relevance);
  assert.ok(result.score >= config.minimumScore, `score was ${result.score}`);
  assert.ok(result.matchedKeywords.includes("trump"));
  assert.equal(result.category, "War & Security");
});

test("celebrity lifestyle content is downranked", () => {
  const result = scoreStory({
    title: "Celebrity fashion and box office roundup",
    excerpt: "A reality TV star shares a recipe.",
    sourceWeight: 1
  }, config.relevance);
  assert.ok(result.score < config.minimumScore, `score was ${result.score}`);
});
