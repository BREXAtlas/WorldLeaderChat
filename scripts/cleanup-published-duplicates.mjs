import { readFile, writeFile } from "node:fs/promises";

const publishedPath = "data/published-events.json";
const logPath = "data/editorial-log.json";
const metaPath = "data/site-meta.json";

const canonicalId = "2026-08-09-israel-rejects-trump-s-15-point-plan-for-gaza";
const duplicateIds = new Set([
  canonicalId,
  "2026-08-09-israel-rejects-trump-s-15-point-plan-for-gaza-netanyahu-says",
  "2026-08-09-middle-east-crisis-live-netanyahu-rejects-us-s-gaza-plan-and-vow"
]);

const published = JSON.parse(await readFile(publishedPath, "utf8"));
const log = JSON.parse(await readFile(logPath, "utf8"));
const matches = published.filter((event) => duplicateIds.has(event.id));

if (matches.length > 1) {
  let canonical = matches.find((event) => event.id === canonicalId) || matches[0];
  const sources = [];
  const seenUrls = new Set();
  for (const event of matches) {
    for (const source of event.sources || []) {
      if (!source?.url || seenUrls.has(source.url)) continue;
      seenUrls.add(source.url);
      sources.push(source);
    }
  }

  canonical = {
    ...canonical,
    id: canonicalId,
    eventDate: "2026-08-09",
    year: 2026,
    date: "August 9, 2026",
    title: "TRUMP POSTS A 15-POINT GAZA PLAN; NETANYAHU REPLIES WITH POINT 16: NO",
    kicker: "A U.S. Gaza proposal meets Israeli rejection, so the fictional leaders’ chat turns into a negotiation over what the word ‘plan’ was supposed to mean.",
    category: "War & Security",
    summary: "Prime Minister Benjamin Netanyahu rejected the U.S. 15-point Gaza plan and said Israeli forces would not withdraw until Hamas disarms, according to reporting from BBC News, Al Jazeera and The Guardian.",
    sources,
    messages: [
      { speaker: "UN Admin", text: "New thread: Gaza plan. Facts and public statements are sourced; the private replies below are fictional satire.", kind: "system", reaction: "" },
      { speaker: "Trump", text: "Fifteen points. Very complete. People love numbered plans because you can tell they have points.", kind: "satire", reaction: "" },
      { speaker: "Netanyahu", text: "I read all fifteen. I have notes. The first note is no withdrawal before disarmament.", kind: "satire", reaction: "" },
      { speaker: "Macron", text: "A plan is not yet an agreement. Europe has several binders proving this.", kind: "satire", reaction: "" },
      { speaker: "Meloni", text: "Can we get one geopolitical document where the word ‘final’ survives contact with the participants?", kind: "satire", reaction: "" },
      { speaker: "Xi", text: "China notes that numbered plans have a tendency to acquire additional points after publication.", kind: "satire", reaction: "" }
    ],
    meme: "UN Admin renamed the file: 15-POINT-PLAN_v7_FINAL_FINAL.pdf",
    tone: "sober",
    editorial: {
      ...canonical.editorial,
      singleSourceException: "",
      reviewNotes: "Merged three reports covering the same Gaza-plan rejection into one event. S-M-A-R review keeps the satire focused on leaders and negotiation dynamics, not civilians.",
      mergedIssueNumbers: matches.map((event) => event.editorial?.issueNumber).filter(Boolean).sort((a, b) => a - b),
      mergedEventIds: matches.map((event) => event.id)
    }
  };

  const cleaned = published.filter((event) => !duplicateIds.has(event.id));
  cleaned.push(canonical);
  cleaned.sort((a, b) => String(b.eventDate).localeCompare(String(a.eventDate)) || String(a.id).localeCompare(String(b.id)));

  const duplicateLogs = log.filter((entry) => duplicateIds.has(entry.eventId));
  const canonicalLog = duplicateLogs.find((entry) => entry.eventId === canonicalId) || duplicateLogs[0];
  const cleanedLog = log.filter((entry) => !duplicateIds.has(entry.eventId));
  if (canonicalLog) {
    cleanedLog.push({
      ...canonicalLog,
      eventId: canonicalId,
      sourceUrls: sources.map((source) => source.url),
      mergedIssueNumbers: canonical.editorial.mergedIssueNumbers,
      mergedEventIds: canonical.editorial.mergedEventIds
    });
  }

  const now = new Date().toISOString();
  await writeFile(publishedPath, `${JSON.stringify(cleaned, null, 2)}\n`, "utf8");
  await writeFile(logPath, `${JSON.stringify(cleanedLog, null, 2)}\n`, "utf8");
  await writeFile(metaPath, `${JSON.stringify({
    schemaVersion: 1,
    generatedAt: now,
    publishedEventCount: cleaned.length,
    latestEventDate: cleaned[0]?.eventDate ?? null
  }, null, 2)}\n`, "utf8");
  console.log(`Merged ${matches.length} Gaza-plan duplicates into ${canonicalId}; ${cleaned.length} published events remain.`);
} else {
  console.log("No current Gaza-plan duplicate cleanup was needed.");
}
