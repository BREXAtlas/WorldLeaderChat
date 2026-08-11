import test from "node:test";
import assert from "node:assert/strict";
import { gunzipSync } from "node:zlib";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

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

test("desk-fill package contains one complete current recommendation per newsroom desk", async () => {
  const encoded = (await read("config/desk-fill-2026-08-09.json.gz.b64")).trim();
  const candidates = JSON.parse(gunzipSync(Buffer.from(encoded, "base64")).toString("utf8"));
  assert.equal(candidates.length, 8);
  assert.deepEqual(new Set(candidates.map((candidate) => candidate.desk)), new Set(REQUIRED_DESKS));

  for (const candidate of candidates) {
    assert.match(candidate.publishedAt, /^2026-08-0[4-9]T/);
    assert.equal(candidate.bundle.event.category, candidate.desk);
    assert.ok(candidate.bundle.event.sources.length >= 2, `${candidate.desk} should have at least two sources`);
    assert.ok(candidate.bundle.event.article.body.length >= 3, `${candidate.desk} should have a short article`);
    assert.ok(candidate.bundle.event.messages.length >= 10 && candidate.bundle.event.messages.length <= 14, `${candidate.desk} should have 10–14 messages`);
    assert.equal(candidate.bundle.status, "draft");
    assert.equal(candidate.bundle.factCheck.articleMatchesSources, false);
  }
});

test("ingestion attempts all eight desks before filling extra candidate slots", async () => {
  const ingestion = await read("scripts/ingest-news.mjs");
  for (const desk of REQUIRED_DESKS) assert.match(ingestion, new RegExp(desk.replace(/[&]/g, "&")));
  assert.match(ingestion, /Math\.max\(Number\(config\.lookbackHours \|\| 72\), 168\)/);
  assert.match(ingestion, /Math\.max\(Number\(config\.maxCandidatesPerRun \|\| 16\), 24\)/);
  assert.match(ingestion, /minimumPerDesk = Number\(process\.env\.WLC_MINIMUM_PER_DESK \|\| 2\)/);
  assert.match(ingestion, /for \(const desk of REQUIRED_DESKS\)/);
  assert.match(ingestion, /item\.newsroomDesk === desk/);
  assert.match(ingestion, /deskCoverage/);
  assert.match(ingestion, /currentDayDeskCoverage/);
});

test("eight-desk issue seeder is valid JavaScript and is idempotent by fingerprint", async () => {
  const scriptPath = new URL("../seed-eight-desk-issues.mjs", import.meta.url);
  const check = spawnSync(process.execPath, ["--check", fileURLToPath(scriptPath)], { encoding: "utf8" });
  assert.equal(check.status, 0, check.stderr);
  const source = await read("scripts/seed-eight-desk-issues.mjs");
  assert.match(source, /existingFingerprints/);
  assert.match(source, /ready-for-approval/);
  assert.match(source, /10–14-message conversation/);
});
