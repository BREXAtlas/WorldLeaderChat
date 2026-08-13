import test from "node:test";
import assert from "node:assert/strict";
import { assignRelatedEventGroup, sameUnderlyingEvent } from "../lib/related-events.mjs";

const message = (speaker) => ({ speaker, text: "A source-grounded response about this event belongs here.", kind: "satire" });

const guardian = {
  id: "guardian-lakers",
  eventDate: "2026-08-13",
  title: "Lakers Change Hands Again: $12.5 Billion Poker Chip in Power Players’ Hands",
  kicker: "The NBA team is set to be sold for a record-breaking sum.",
  article: { headline: "Lakers Change Hands Again", dek: "The Los Angeles Lakers are set to be sold for $12.5 billion." },
  messages: [message("Josh Kushner"), message("Bob Iger"), message("Mark Walter")],
  sources: [{ url: "https://example.com/guardian-lakers" }]
};

const cnbc = {
  id: "cnbc-lakers",
  eventDate: "2026-08-12",
  title: "Kushner and Iger Acquire Mark Walter’s Stake in Los Angeles Lakers for $12.5 Billion",
  kicker: "Business & Power",
  article: { headline: "Kushner and Iger acquire Lakers stake", dek: "Joshua Kushner and Bob Iger acquire Mark Walter’s Los Angeles Lakers stake for $12.5 billion." },
  messages: [message("Joshua Kushner"), message("Bob Iger"), message("Mark Walter")],
  sources: [{ url: "https://example.com/cnbc-lakers" }]
};

test("publication assigns a persistent two-way event group to matching coverage", () => {
  const existing = structuredClone(cnbc);
  const incoming = structuredClone(guardian);
  const result = assignRelatedEventGroup(incoming, [existing]);
  assert.equal(result.related.length, 1);
  assert.ok(result.eventGroup);
  assert.equal(incoming.eventGroup, result.eventGroup);
  assert.equal(existing.eventGroup, result.eventGroup);
});

test("same participants do not group a different transaction without the event anchor", () => {
  const unrelated = {
    ...structuredClone(guardian),
    id: "disney-board",
    title: "Disney board discusses streaming strategy",
    kicker: "A media company weighs another restructuring plan.",
    article: { headline: "Disney reviews streaming strategy", dek: "Directors debate a new entertainment plan without a sports transaction." }
  };
  assert.equal(sameUnderlyingEvent(cnbc, unrelated), false);
});
