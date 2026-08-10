import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

async function install(events) {
  const source = await read("recency-order.js");
  const context = { allEvents: () => events };
  context.window = context;
  vm.runInNewContext(source, context);
  return { context, source };
}

test("August and all other newsroom files sort by event date newest first", async () => {
  const events = [
    { id: "aug-8", eventDate: "2026-08-08", date: "August 8, 2026" },
    { id: "aug-10", eventDate: "2026-08-10", date: "August 10, 2026" },
    { id: "aug-9", eventDate: "2026-08-09", date: "August 9, 2026" }
  ];
  const { context } = await install(events);
  assert.deepEqual(Array.from(context.allEvents(), (event) => event.id), ["aug-10", "aug-9", "aug-8"]);
});

test("same-day articles use source publication time as the recency tie-breaker", async () => {
  const events = [
    { id: "morning", eventDate: "2026-08-10", editorial: { sourcePublishedAt: "2026-08-10T13:00:00Z" } },
    { id: "evening", eventDate: "2026-08-10", editorial: { sourcePublishedAt: "2026-08-10T20:00:00Z" } }
  ];
  const { context } = await install(events);
  assert.deepEqual(Array.from(context.allEvents(), (event) => event.id), ["evening", "morning"]);
});

test("legacy display dates are included in newest-first ordering", async () => {
  const events = [
    { id: "july", date: "July 24, 2026" },
    { id: "august", date: "August 2, 2026" },
    { id: "june-range", date: "June 15–17, 2026" }
  ];
  const { context, source } = await install(events);
  assert.deepEqual(Array.from(context.allEvents(), (event) => event.id), ["august", "july", "june-range"]);
  assert.match(source, /WLC_compareRecency/);
});

test("Pages build loads recency ordering before the monthly renderer", async () => {
  const build = await read("scripts/build-site.mjs");
  const recencyIndex = build.indexOf("recency-order.js");
  const monthlyIndex = build.indexOf("rolling-archive.js");
  assert.ok(recencyIndex >= 0 && monthlyIndex > recencyIndex);
  assert.match(build, /recency-order\.js\?v=20260810/);
});
