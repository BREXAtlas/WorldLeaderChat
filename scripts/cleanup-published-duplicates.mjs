import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { mergePublishedDuplicates } from "./lib/published-dedupe.mjs";

const publishedPath = resolve(process.cwd(), "data/published-events.json");
const metaPath = resolve(process.cwd(), "data/site-meta.json");
const current = JSON.parse(await readFile(publishedPath, "utf8"));
const result = mergePublishedDuplicates(current);

if (!result.changes.length) {
  console.log("No published duplicate groups required cleanup.");
  process.exit(0);
}

result.events.sort((a, b) => String(b.eventDate).localeCompare(String(a.eventDate)) || String(a.id).localeCompare(String(b.id)));
await writeFile(publishedPath, `${JSON.stringify(result.events, null, 2)}\n`, "utf8");
await writeFile(metaPath, `${JSON.stringify({
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  publishedEventCount: result.events.length,
  latestEventDate: result.events[0]?.eventDate ?? null
}, null, 2)}\n`, "utf8");

for (const change of result.changes) {
  console.log(`Merged ${change.removedIds.join(", ")} into ${change.canonicalId} (${change.sourceCount} sources).`);
}
console.log(`Published events reduced from ${current.length} to ${result.events.length}.`);
