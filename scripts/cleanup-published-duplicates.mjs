import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { mergePublishedDuplicates } from "./lib/published-dedupe.mjs";
import { polishPublishedEvents } from "./lib/published-polish.mjs";

const publishedPath = resolve(process.cwd(), "data/published-events.json");
const metaPath = resolve(process.cwd(), "data/site-meta.json");
const current = JSON.parse(await readFile(publishedPath, "utf8"));
const merged = mergePublishedDuplicates(current);
const polished = polishPublishedEvents(merged.events);

if (!merged.changes.length && !polished.changes.length) {
  console.log("No published duplicate or dialogue changes required cleanup.");
  process.exit(0);
}

polished.events.sort((a, b) => {
  const dateOrder = String(b.eventDate).localeCompare(String(a.eventDate));
  if (dateOrder) return dateOrder;
  const sourceOrder = String(b.editorial?.sourcePublishedAt || "").localeCompare(String(a.editorial?.sourcePublishedAt || ""));
  if (sourceOrder) return sourceOrder;
  return String(b.publishedAt || "").localeCompare(String(a.publishedAt || "")) || String(a.id).localeCompare(String(b.id));
});

await writeFile(publishedPath, `${JSON.stringify(polished.events, null, 2)}\n`, "utf8");
await writeFile(metaPath, `${JSON.stringify({
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  publishedEventCount: polished.events.length,
  latestEventDate: polished.events[0]?.eventDate ?? null
}, null, 2)}\n`, "utf8");

for (const change of merged.changes) {
  console.log(`Merged ${change.removedIds.join(", ")} into ${change.canonicalId} (${change.sourceCount} sources).`);
}
for (const change of polished.changes) {
  console.log(`Replaced repetitive published chat for ${change.eventId} (issue #${change.issueNumber ?? "unknown"}).`);
}
console.log(`Published events changed from ${current.length} to ${polished.events.length}.`);
