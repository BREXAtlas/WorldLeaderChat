import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { appendGitHubOutput, readJson, writeJson } from "./lib/io.mjs";

const eventPath = process.env.GITHUB_EVENT_PATH;
if (!eventPath) throw new Error("GITHUB_EVENT_PATH is required.");

const githubEvent = JSON.parse(await readFile(eventPath, "utf8"));
const issueNumber = Number(githubEvent.issue?.number || 0);
if (!issueNumber) throw new Error("The GitHub event does not contain an editorial issue number.");

const publishedPath = resolve(process.cwd(), "data/published-events.json");
const published = await readJson(publishedPath, []);
const selected = published.find((event) => Number(event.editorial?.issueNumber) === issueNumber);
if (!selected) throw new Error(`Issue #${issueNumber} is not attached to a published World Leader Chat article.`);

for (const event of published) {
  if (event.id === selected.id) event.featured = true;
  else delete event.featured;
}

await writeJson(publishedPath, published);
await appendGitHubOutput("event_id", selected.id);
console.log(`Selected '${selected.id}' as the World Leader Chat main headline.`);
