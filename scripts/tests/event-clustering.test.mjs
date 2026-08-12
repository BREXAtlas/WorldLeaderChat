import test from "node:test";
import assert from "node:assert/strict";
import { sameNewsEvent, topicBigrams, topicTerms } from "../lib/event-clustering.mjs";

function candidate(title) {
  return {
    publishedAt: "2026-08-12T18:00:00.000Z",
    topicTerms: topicTerms(title),
    topicBigrams: topicBigrams(title)
  };
}

test("clusters differently worded reports about the same named sports event", () => {
  assert.equal(sameNewsEvent(
    candidate("What to watch over the next three weeks, starting with the St. Jude Championship"),
    candidate("2026 St. Jude Championship TV schedule and FedEx Cup coverage")
  ), true);
});

test("does not group unrelated stories merely because both mention a World Cup", () => {
  assert.equal(sameNewsEvent(
    candidate("England coach names squad for the Rugby World Cup"),
    candidate("South America debates hosting the 2030 football World Cup")
  ), false);
});
