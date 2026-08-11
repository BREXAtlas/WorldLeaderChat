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

const aliases = new Map([
  ["war & security", "War & Security"], ["world news", "World News"], ["politics & society", "Politics & Society"],
  ["technology & ai", "Technology & AI"], ["science & space", "Science & Space"], ["business & power", "Business & Power"],
  ["trade & economy", "Business & Power"], ["culture & entertainment", "Culture & Entertainment"],
  ["sports & soft power", "Sports & Soft Power"], ["election", "Politics & Society"], ["elections", "Politics & Society"],
  ["courts & congress", "Politics & Society"], ["health & society", "Politics & Society"]
]);

function deskFor(event) {
  const category = String(event?.category || "").toLowerCase().trim();
  if (aliases.has(category)) return aliases.get(category);
  const text = `${event?.category || ""} ${event?.title || ""} ${event?.summary || ""}`.toLowerCase();
  if (/\bwar\b|security|airstrike|missile|military|hostage|ceasefire|invasion|nuclear|gaza|ukraine|battlefield|armed conflict/.test(text)) return "War & Security";
  if (/technology|artificial intelligence|\bai\b|cyber|tiktok|openai|chip|semiconductor|software|robot/.test(text)) return "Technology & AI";
  if (/science|space|rocket|nasa|spacex|moon|mars|telescope|asteroid|discovery|research/.test(text)) return "Science & Space";
  if (/business|economy|trade|tariff|market|company|billionaire|antitrust|merger|bank|finance|chief executive|\bceo\b/.test(text)) return "Business & Power";
  if (/culture|entertainment|music|song|album|film|movie|television|streaming|actor|podcast|book|copyright|theater|theatre/.test(text)) return "Culture & Entertainment";
  if (/sports|sport|olympics|world cup|championship|medal|fifa|athlete|tournament|gymnastics|football|basketball|baseball|soccer|tennis/.test(text)) return "Sports & Soft Power";
  if (/election|congress|senate|court|immigration|border|protest|civil rights|health|society|campaign|governor|parliament|vote|ballot/.test(text)) return "Politics & Society";
  return "World News";
}

const selectedDesk = deskFor(selected);
const replacedIssueNumbers = [];
for (const event of published) {
  if (event.id === selected.id) event.featured = true;
  else if (event.featured && deskFor(event) === selectedDesk) {
    delete event.featured;
    if (event.editorial?.issueNumber) replacedIssueNumbers.push(Number(event.editorial.issueNumber));
  }
}

await writeJson(publishedPath, published);
await appendGitHubOutput("event_id", selected.id);
await appendGitHubOutput("desk", selectedDesk);
await appendGitHubOutput("replaced_issue_numbers", replacedIssueNumbers.join(" "));
console.log(`Selected '${selected.id}' for the ${selectedDesk} featured-carousel slot.`);
