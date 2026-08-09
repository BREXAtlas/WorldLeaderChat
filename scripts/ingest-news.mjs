import { resolve } from "node:path";
import { candidateFingerprint } from "./lib/editorial.mjs";
import { parseFeed } from "./lib/feed.mjs";
import { cleanWhitespace, normalizeUrl, readJson, writeJson } from "./lib/io.mjs";
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

const stopwords = new Set([
  "a","an","and","are","as","at","be","by","for","from","has","have","in","is","it","its","of","on","s","says","say","the","to","us","with","after","amid","latest","live","news","update","updates"
]);

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

function topicTerms(value) {
  return new Set(cleanWhitespace(value)
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((term) => term.length > 2 && !stopwords.has(term)));
}

function hoursApart(a, b) {
  const left = new Date(a || 0).valueOf();
  const right = new Date(b || 0).valueOf();
  if (!Number.isFinite(left) || !Number.isFinite(right) || !left || !right) return 0;
  return Math.abs(left - right) / 3600000;
}

function sameNewsEvent(a, b) {
  if (hoursApart(a.publishedAt, b.publishedAt) > 36) return false;
  const left = a.topicTerms;
  const right = b.topicTerms;
  const intersection = [...left].filter((term) => right.has(term)).length;
  const union = new Set([...left, ...right]).size || 1;
  const jaccard = intersection / union;
  return jaccard >= 0.5 || (intersection >= 4 && jaccard >= 0.34);
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

      const title = cleanWhitespace(item.title).slice(0, 300);
      rawCandidates.push({
        fingerprint: candidateFingerprint({ ...item, url }),
        topicTerms: topicTerms(title),
        sourceId: item.sourceId,
        publisher: item.publisher,
        title,
        url,
        publishedAt: item.publishedAt,
        excerpt: cleanWhitespace(item.excerpt).slice(0, 1000),
        relevanceScore: scored.score,
        matchedKeywords: scored.matchedKeywords,
        category: scored.category
      });
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

// Cross-publisher event dedupe: different outlets frequently headline the same event differently.
// Keep the strongest candidate when titles substantially overlap within a 36-hour window.
const clusters = [];
for (const candidate of rawCandidates.sort((a, b) => b.relevanceScore - a.relevanceScore)) {
  const existing = clusters.find((item) => sameNewsEvent(item, candidate));
  if (!existing) {
    clusters.push(candidate);
    continue;
  }
  console.log(`Collapsed same-event coverage: ${candidate.publisher} “${candidate.title}” -> ${existing.publisher} “${existing.title}”`);
}

const candidates = clusters
  .sort((a, b) => {
    if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore;
    return String(b.publishedAt ?? "").localeCompare(String(a.publishedAt ?? ""));
  })
  .slice(0, maxCandidates)
  .map(({ topicTerms: _topicTerms, ...candidate }) => candidate);

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
