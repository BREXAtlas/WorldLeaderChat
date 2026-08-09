import { resolve } from "node:path";
import { candidateFingerprint } from "./lib/editorial.mjs";
import { parseFeed } from "./lib/feed.mjs";
import { cleanWhitespace, normalizeUrl, readJson, sha256, writeJson } from "./lib/io.mjs";
import { scoreStory } from "./lib/scoring.mjs";

const root = process.cwd();
const configPath = resolve(root, "config/news-sources.json");
const outputPath = resolve(root, process.env.INGESTION_OUTPUT || "tmp/ingestion-candidates.json");
const config = await readJson(configPath);
const lookbackHours = Number(process.env.WLC_LOOKBACK_HOURS || config.lookbackHours || 72);
const minimumScore = Number(process.env.WLC_MINIMUM_SCORE || config.minimumScore || 7);
const maxCandidates = Number(process.env.WLC_MAX_CANDIDATES || config.maxCandidatesPerRun || 8);
const timeoutMs = Number(config.requestTimeoutMs || 20000);
const cutoff = Date.now() - lookbackHours * 60 * 60 * 1000;
const futureLimit = Date.now() + 48 * 60 * 60 * 1000;

async function fetchFeed(source) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(source.url, {
      headers: {
        accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.2",
        "user-agent": "WorldLeaderChat-NewsDesk/1.0 (+https://github.com/BREXAtlas/WorldLeaderChat)"
      },
      redirect: "follow",
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

function titleKey(value) {
  return cleanWhitespace(value)
    .toLowerCase()
    .replace(/\s[-|]\s[^-|]{1,40}$/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const sourceReports = [];
const rawCandidates = [];
let successfulSources = 0;

for (const source of config.sources.filter((entry) => entry.enabled)) {
  try {
    const xml = await fetchFeed(source);
    const items = parseFeed(xml, source);
    successfulSources += 1;
    sourceReports.push({ sourceId: source.id, status: "ok", items: items.length });

    for (const item of items) {
      const publishedTime = item.publishedAt ? new Date(item.publishedAt).valueOf() : null;
      if (publishedTime && (publishedTime < cutoff || publishedTime > futureLimit)) continue;

      const scored = scoreStory(item, config.relevance);
      if (scored.score < minimumScore) continue;

      const url = normalizeUrl(item.url);
      try {
        if (new URL(url).protocol !== "https:") {
          console.error(`::warning title=Story skipped::${source.publisher} returned a non-HTTPS story URL.`);
          continue;
        }
      } catch {
        console.error(`::warning title=Story skipped::${source.publisher} returned an invalid story URL.`);
        continue;
      }
      const candidate = {
        fingerprint: candidateFingerprint({ ...item, url }),
        titleFingerprint: sha256(titleKey(item.title)),
        sourceId: item.sourceId,
        publisher: item.publisher,
        title: cleanWhitespace(item.title).slice(0, 300),
        url,
        publishedAt: item.publishedAt,
        excerpt: cleanWhitespace(item.excerpt).slice(0, 1000),
        relevanceScore: scored.score,
        matchedKeywords: scored.matchedKeywords,
        category: scored.category
      };
      rawCandidates.push(candidate);
    }
  } catch (error) {
    const message = error?.name === "AbortError" ? `Timed out after ${timeoutMs}ms` : error.message;
    sourceReports.push({ sourceId: source.id, status: "error", error: message });
    console.error(`::warning title=Feed failed::${source.publisher}: ${message}`);
  }
}

if (!successfulSources) {
  throw new Error("Every configured news feed failed. No editorial issues were created.");
}

const deduplicated = new Map();
for (const candidate of rawCandidates) {
  const current = deduplicated.get(candidate.titleFingerprint);
  if (!current || candidate.relevanceScore > current.relevanceScore) {
    deduplicated.set(candidate.titleFingerprint, candidate);
  }
}

const candidates = [...deduplicated.values()]
  .sort((a, b) => {
    if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore;
    return String(b.publishedAt ?? "").localeCompare(String(a.publishedAt ?? ""));
  })
  .slice(0, maxCandidates)
  .map(({ titleFingerprint: _titleFingerprint, ...candidate }) => candidate);

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  settings: { lookbackHours, minimumScore, maxCandidates },
  sourceReports,
  candidates
};

await writeJson(outputPath, report);
console.log(`News ingestion produced ${candidates.length} candidate(s) from ${successfulSources} working source(s).`);
console.log(`Output: ${outputPath}`);
