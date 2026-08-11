import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { selectDiverseCandidates, summarizePublisherCoverage } from "../lib/candidate-selection.mjs";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const REQUIRED_DESKS = [
  "War & Security",
  "World News",
  "Politics & Society",
  "Technology & AI",
  "Science & Space",
  "Business & Power",
  "Culture & Entertainment",
  "Sports & Soft Power"
];

const normalizedDesk = (desk) => desk === "US Politics & Society" ? "Politics & Society" : desk;

test("every topic desk has an array of at least three configured publishers", async () => {
  const config = JSON.parse(await read("config/news-sources.json"));
  assert.ok(Array.isArray(config.sources));
  assert.equal(config.sourceDiversity.minimumPublishersPerRun, 8);
  assert.equal(config.sourceDiversity.minimumPublishersPerDesk, 2);
  assert.equal(config.sourceDiversity.maximumCandidatesPerPublisher, 4);

  const deskPublishers = new Map(REQUIRED_DESKS.map((desk) => [desk, new Set()]));
  for (const source of config.sources.filter((item) => item.enabled)) {
    assert.match(source.url, /^https:\/\//);
    deskPublishers.get(normalizedDesk(source.desk))?.add(source.publisher);
  }

  for (const desk of REQUIRED_DESKS) {
    assert.ok(deskPublishers.get(desk).size >= 3, `${desk} needs at least three configured publishers`);
  }

  const culture = deskPublishers.get("Culture & Entertainment");
  for (const publisher of ["BBC News", "The Guardian", "Rolling Stone", "Variety", "Deadline", "NPR"]) {
    assert.ok(culture.has(publisher), `Culture & Entertainment is missing ${publisher}`);
  }
});

test("candidate selection diversifies each desk and prevents a dominant feed from taking the slate", () => {
  const candidates = REQUIRED_DESKS.flatMap((desk, deskIndex) => [
    ["Dominant Wire", 100],
    [`${desk} Source A`, 90],
    [`${desk} Source B`, 80]
  ].map(([publisher, score], sourceIndex) => ({
    fingerprint: `${deskIndex}-${sourceIndex}`,
    newsroomDesk: desk,
    category: desk,
    publisher,
    sources: [{ publisher, label: `${desk} report`, url: `https://example.com/${deskIndex}/${sourceIndex}` }],
    relevanceScore: score,
    publishedAt: "2026-08-10T14:00:00.000Z"
  })));

  const selected = selectDiverseCandidates(candidates, {
    limit: 20,
    requiredDesks: REQUIRED_DESKS,
    minimumPerDesk: 2,
    maximumPerPublisher: 4,
    minimumPublishers: 8,
    minimumPublishersPerDesk: 2,
    isCurrentDay: () => true
  });
  const coverage = summarizePublisherCoverage(selected, REQUIRED_DESKS);

  assert.equal(selected.length, 20);
  assert.ok(coverage.distinctPublishers >= 8);
  assert.ok(Math.max(...Object.values(coverage.primaryPublishers)) <= 4);
  for (const desk of REQUIRED_DESKS) {
    assert.ok(selected.filter((candidate) => candidate.newsroomDesk === desk).length >= 2);
    assert.ok(coverage.desks[desk].distinctPublishers >= 2, `${desk} should use multiple publishers`);
  }
});

test("publisher summary reports every source retained in an article's sources array", () => {
  const coverage = summarizePublisherCoverage([{
    newsroomDesk: "World News",
    publisher: "Publisher A",
    sources: [
      { publisher: "Publisher A" },
      { publisher: "Publisher B" },
      { publisher: "Official Record" }
    ]
  }], REQUIRED_DESKS);

  assert.equal(coverage.distinctPublishers, 3);
  assert.deepEqual(Object.keys(coverage.desks["World News"].publishers), ["Official Record", "Publisher A", "Publisher B"]);
});

test("news workflow exposes and reports publisher diversity controls", async () => {
  const workflow = await read(".github/workflows/news-ingestion.yml");
  const ingestion = await read("scripts/ingest-news.mjs");
  assert.match(workflow, /WLC_MINIMUM_PUBLISHERS: "8"/);
  assert.match(workflow, /WLC_MINIMUM_PUBLISHERS_PER_DESK: "2"/);
  assert.match(workflow, /WLC_MAXIMUM_PER_PUBLISHER: "4"/);
  assert.match(workflow, /report-ingestion-summary\.mjs/);
  assert.match(ingestion, /publisherCoverage/);
  assert.match(ingestion, /sourceReports\.push\(\{ sourceId: source\.id, publisher: source\.publisher/);
});
