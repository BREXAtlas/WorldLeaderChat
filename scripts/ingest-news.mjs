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
const maxCandidates = Number(process.env.WLC_MAX_CANDIDATES || config.maxCandidatesPerRun || 12);
const timeoutMs = Number(config.requestTimeoutMs || 20000);
const cutoff = Date.now() - lookbackHours * 60 * 60 * 1000;
const futureLimit = Date.now() + 48 * 60 * 60 * 1000;

const stopwords = new Set([
  "a","an","and","are","as","at","be","by","for","from","has","have","in","is","it","its","of","on","s","says","say","the","to","us","with","after","amid","latest","live","news","update","updates","new","report"
]);

async function fetchFeed(source) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(source.url, {
      headers: {
        accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.2",
        "user-agent": "WorldLeaderChat-NewsDesk/2.0 (+https://github.com/BREXAtlas/WorldLeaderChat)"
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
  return jaccard >= 0.48 || (intersection >= 4 && jaccard >= 0.31);
}

function sourceRecord(candidate) {
  return {
    label: candidate.title,
    url: candidate.url,
    publisher: candidate.publisher,
    publishedAt: candidate.publishedAt,
    excerpt: candidate.excerpt
  };
}

function addCoverage(cluster, candidate) {
  if (!cluster.sources.some((source) => source.url === candidate.url)) {
    cluster.sources.push(sourceRecord(candidate));
  }
  cluster.coveragePublishers = [...new Set(cluster.sources.map((source) => source.publisher))];
}

function selectDiverseCandidates(clusters, limit) {
  const selected = [];
  const selectedIds = new Set();
  const categoryCounts = new Map();
  const deskCounts = new Map();
  const sorted = [...clusters].sort((a, b) => {
    if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore;
    return String(b.publishedAt ?? "").localeCompare(String(a.publishedAt ?? ""));
  });

  // First pass: give strong non-political desks a chance to appear beside hard news.
  const preferredDesks = [
    "World News",
    "US Politics & Society",
    "Technology & AI",
    "Science & Space",
    "Business & Power",
    "Culture & Entertainment",
    "Sports & Soft Power"
  ];
  for (const desk of preferredDesks) {
    const candidate = sorted.find((item) => item.sourceDesk === desk && !selectedIds.has(item.fingerprint));
    if (!candidate || selected.length >= limit) continue;
    selected.push(candidate);
    selectedIds.add(candidate.fingerprint);
    categoryCounts.set(candidate.category, 1);
    deskCounts.set(candidate.sourceDesk, 1);
  }

  // Second pass: fill the run by score, while preventing one conflict/category from owning the queue.
  for (const candidate of sorted) {
    if (selected.length >= limit || selectedIds.has(candidate.fingerprint)) continue;
    const categoryCount = categoryCounts.get(candidate.category) || 0;
    const deskCount = deskCounts.get(candidate.sourceDesk) || 0;
    if (categoryCount >= 3 || deskCount >= 4) continue;
    selected.push(candidate);
    selectedIds.add(candidate.fingerprint);
    categoryCounts.set(candidate.category, categoryCount + 1);
    deskCounts.set(candidate.sourceDesk, deskCount + 1);
  }

  return selected;
}

const sourceReports = [];
const rawCandidates = [];
let successfulSources = 0;

for (const source of config.sources.filter((entry) => entry.enabled)) {
  try {
    const xml = await fetchFeed(source);
    const items = parseFeed(xml, source);
    successfulSources += 1;
    sourceReports.push({ sourceId: source.id, desk: source.desk, status: "ok", items: items.length });

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
        topicTerms: topicTerms(`${title} ${item.excerpt}`),
        sourceId: item.sourceId,
        sourceDesk: item.sourceDesk,
        publisher: item.publisher,
        title,
        url,
        publishedAt: item.publishedAt,
        excerpt: cleanWhitespace(item.excerpt).slice(0, 1000),
        relevanceScore: scored.score,
        matchedKeywords: scored.matchedKeywords,
        category: scored.category,
        sources: []
      });
    }
  } catch (error) {
    const message = error?.name === "AbortError" ? `Timed out after ${timeoutMs}ms` : error.message;
    sourceReports.push({ sourceId: source.id, desk: source.desk, status: "error", error: message });
    console.error(`::warning title=Feed failed::${source.publisher}: ${message}`);
  }
}

if (!successfulSources) {
  throw new Error("Every configured news feed failed. No editorial issues were created.");
}

// Cross-publisher event dedupe keeps one editorial file while preserving every original source link.
const clusters = [];
for (const candidate of rawCandidates.sort((a, b) => b.relevanceScore - a.relevanceScore)) {
  const existing = clusters.find((item) => sameNewsEvent(item, candidate));
  if (!existing) {
    candidate.sources = [sourceRecord(candidate)];
    candidate.coveragePublishers = [candidate.publisher];
    clusters.push(candidate);
    continue;
  }
  addCoverage(existing, candidate);
  existing.relevanceScore = Math.max(existing.relevanceScore, candidate.relevanceScore);
  existing.matchedKeywords = [...new Set([...existing.matchedKeywords, ...candidate.matchedKeywords])];
  console.log(`Merged same-event coverage: ${candidate.publisher} “${candidate.title}” -> ${existing.publisher} “${existing.title}”`);
}

const candidates = selectDiverseCandidates(clusters, maxCandidates)
  .map(({ topicTerms: _topicTerms, ...candidate }) => candidate);

const report = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  settings: { lookbackHours, minimumScore, maxCandidates },
  sourceReports,
  candidates
};

await writeJson(outputPath, report);
console.log(`News ingestion produced ${candidates.length} candidate(s) from ${successfulSources} working source(s).`);
console.log(`Output: ${outputPath}`);
