import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mergePublishedDuplicates } from "../lib/published-dedupe.mjs";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("current newsroom follows the exact today-minus-seven through today window", async () => {
  const source = await read("rolling-archive.js");
  assert.match(source, /DAYS_BEFORE_TODAY = 7/);
  assert.match(source, /const windowStart = addDays\(today, -DAYS_BEFORE_TODAY\)/);
  assert.match(source, /value >= windowStart\.getTime\(\) && value <= today\.getTime\(\)/);
  assert.match(source, /CURRENT FILES \/\//);
  assert.match(source, /event\.id !== leadId/);
});

test("current year archives by month then day before older year archives", async () => {
  const source = await read("rolling-archive.js");
  assert.match(source, /MONTH &amp; DAY ARCHIVE/);
  assert.match(source, /class="month-archive"/);
  assert.match(source, /class="day-archive"/);
  assert.match(source, /class="historic-archive"/);
  assert.match(source, /ARCHIVE \/\//);
  assert.match(source, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
});

test("headline colors distinguish major news desks", async () => {
  const source = await read("rolling-archive.js");
  for (const desk of [
    "War & Security",
    "Science & Space",
    "Technology & AI",
    "Politics & Society",
    "Business & Power",
    "Culture & Entertainment",
    "Sports & Soft Power"
  ]) {
    assert.match(source, new RegExp(desk.replace(/[&]/g, "&")));
  }
  assert.match(source, /story\[data-desk\][\s\S]*h3 button\{color:var\(--desk\)/);
});

test("known repeated published files merge into canonical multi-source events", () => {
  const events = [
    {
      id: "2026-08-08-ukraine-russia-pounds-kyiv-as-zelenskyy-visits-serbia",
      sources: [{ publisher: "DW", label: "DW report", url: "https://example.com/dw" }],
      editorial: { issueNumber: 13, reviewNotes: "DW review", singleSourceException: "one source" }
    },
    {
      id: "2026-08-08-child-among-three-killed-in-russian-missile-attacks-near-kyiv",
      sources: [{ publisher: "BBC News", label: "BBC report", url: "https://example.com/bbc" }],
      editorial: { issueNumber: 7, reviewNotes: "BBC review", singleSourceException: "one source" }
    },
    {
      id: "2026-08-09-why-is-pezeshkian-urging-an-end-to-iran-s-no-war-no-peace-status",
      summary: "old summary",
      sources: [{ publisher: "Al Jazeera", label: "AJ report", url: "https://example.com/aj" }],
      editorial: { issueNumber: 23, reviewNotes: "AJ review", singleSourceException: "one source" }
    },
    {
      id: "2026-08-06-iran-aims-to-ban-u-s-and-israeli-ships-from-strait-of-hormuz-and",
      sources: [{ publisher: "NPR", label: "NPR report", url: "https://example.com/npr" }],
      editorial: { issueNumber: 8, reviewNotes: "NPR review", singleSourceException: "one source" }
    }
  ];

  const result = mergePublishedDuplicates(events);
  assert.equal(result.events.length, 2);
  assert.equal(result.changes.length, 2);

  const ukraine = result.events.find((event) => event.id.includes("ukraine-russia-pounds"));
  assert.equal(ukraine.sources.length, 2);
  assert.deepEqual(ukraine.editorial.mergedIssueNumbers, [7, 13]);
  assert.equal(ukraine.editorial.singleSourceException, "");

  const hormuz = result.events.find((event) => event.id.includes("no-war-no-peace"));
  assert.equal(hormuz.sources.length, 2);
  assert.match(hormuz.summary, /Al Jazeera and NPR/);
  assert.deepEqual(hormuz.editorial.mergedIssueNumbers, [8, 23]);
});
