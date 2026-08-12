import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { readJson } from "./lib/io.mjs";
import { assertValid, validateEvent } from "./lib/validation.mjs";

const root = process.cwd();
const errors = [];
const policy = await readJson(resolve(root, "config/editorial-policy.json"));
const sourcesConfig = await readJson(resolve(root, "config/news-sources.json"));
const published = await readJson(resolve(root, "data/published-events.json"), []);
const indexHtml = await readFile(resolve(root, "index.html"), "utf8");

if (!Array.isArray(published)) errors.push("data/published-events.json must contain an array.");
const ids = new Set();
const sourceUrls = new Set();
for (const [index, event] of (Array.isArray(published) ? published : []).entries()) {
  errors.push(...validateEvent(event, policy, {
    context: `published event ${index + 1}`,
    requireEditorialMetadata: true
  }));
  if (ids.has(event.id)) errors.push(`Duplicate published event id: ${event.id}`);
  ids.add(event.id);
  for (const source of event.sources ?? []) {
    if (sourceUrls.has(source.url)) errors.push(`Duplicate published source URL: ${source.url}`);
    sourceUrls.add(source.url);
  }
}

if (!indexHtml.includes("data/published-events.json")) {
  errors.push("index.html does not load data/published-events.json.");
}
if (!indexHtml.includes("ALL PRIVATE CHATS ARE FICTIONAL")) {
  errors.push("index.html is missing the prominent fictional-satire disclosure.");
}

if (!Array.isArray(sourcesConfig.sources) || !sourcesConfig.sources.length) {
  errors.push("config/news-sources.json must include at least one source.");
} else {
  const sourceIds = new Set();
  const feedUrls = new Set();
  const enabledPublishers = new Set(sourcesConfig.sources.filter((source) => source.enabled).map((source) => source.publisher));
  for (const source of sourcesConfig.sources) {
    if (!source.id || sourceIds.has(source.id)) errors.push(`Duplicate or missing feed id: ${source.id ?? "(missing)"}`);
    sourceIds.add(source.id);
    try {
      const url = new URL(source.url);
      if (url.protocol !== "https:") errors.push(`Feed ${source.id} must use HTTPS.`);
    } catch {
      errors.push(`Feed ${source.id} has an invalid URL.`);
    }
    if (feedUrls.has(source.url)) errors.push(`Duplicate feed URL: ${source.url}`);
    feedUrls.add(source.url);
  }
  const orientations = sourcesConfig.publisherOrientation || {};
  for (const [publisher, orientation] of Object.entries(orientations)) {
    if (!enabledPublishers.has(publisher)) errors.push(`Oriented publisher is not enabled in the source pool: ${publisher}`);
    if (!new Set(["left", "right", "neutral"]).has(orientation)) errors.push(`Invalid publisher orientation for ${publisher}: ${orientation}`);
  }
  const leftPublishers = Object.entries(orientations).filter(([, orientation]) => orientation === "left").map(([publisher]) => publisher);
  const rightPublishers = Object.entries(orientations).filter(([, orientation]) => orientation === "right").map(([publisher]) => publisher);
  if (leftPublishers.length < 5 || rightPublishers.length < 5) {
    errors.push(`The monitored partisan source pool must contain at least five publishers per side; found ${leftPublishers.length} left and ${rightPublishers.length} right.`);
  }
  if (leftPublishers.length !== rightPublishers.length) {
    errors.push(`The monitored partisan source pool must be equal; found ${leftPublishers.length} left and ${rightPublishers.length} right.`);
  }
  if (Number(sourcesConfig.sourceDiversity?.minimumPublishersPerOrientation) < 4) {
    errors.push("sourceDiversity.minimumPublishersPerOrientation must be at least 4.");
  }
  if (Number(sourcesConfig.sourceDiversity?.maximumOrientationDifference) > 1) {
    errors.push("sourceDiversity.maximumOrientationDifference cannot exceed 1.");
  }
}

const workflowPaths = [
  ".github/workflows/news-ingestion.yml",
  ".github/workflows/editorial-publish.yml",
  ".github/workflows/deploy-pages.yml",
  ".github/workflows/ci.yml"
];

for (const requiredPath of [
  ...workflowPaths,
  ".github/dependabot.yml",
  "docs/EDITORIAL_WORKFLOW.md",
  "docs/NEWS_INGESTION.md"
]) {
  try {
    await access(resolve(root, requiredPath));
  } catch {
    errors.push(`Required repository file is missing: ${requiredPath}`);
  }
}

for (const workflowPath of workflowPaths) {
  const workflow = await readFile(resolve(root, workflowPath), "utf8");
  for (const match of workflow.matchAll(/^\s*uses:\s*([^#\s]+)(?:\s+#.*)?$/gm)) {
    const action = match[1];
    if (action.startsWith("./")) continue;
    const separator = action.lastIndexOf("@");
    const ref = separator >= 0 ? action.slice(separator + 1) : "";
    if (!/^[a-f0-9]{40}$/.test(ref)) {
      errors.push(`${workflowPath} uses '${action}' without a full 40-character commit SHA.`);
    }
  }
}

assertValid(errors, "Repository validation failed");
console.log(`Repository validation passed (${published.length} externally published event(s)).`);
