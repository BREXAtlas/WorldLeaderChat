import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("news ingestion runs four times daily, balances eight desks and drafts before approval", async () => {
  const workflow = await read(".github/workflows/news-ingestion.yml");
  assert.match(workflow, /cron: "20 7,11,15,19 \* \* \*"/);
  assert.match(workflow, /timezone: "America\/Chicago"/);
  assert.match(workflow, /copilot-requests: write/);
  assert.match(workflow, /WLC_LOOKBACK_HOURS:.*168/);
  assert.match(workflow, /WLC_MINIMUM_SCORE:.*4/);
  assert.match(workflow, /WLC_MAX_CANDIDATES:.*24/);
  assert.match(workflow, /WLC_MINIMUM_PER_DESK: "2"/);
  assert.match(workflow, /WLC_MINIMUM_PUBLISHERS: "8"/);
  assert.match(workflow, /WLC_MINIMUM_PUBLISHERS_PER_DESK: "2"/);
  assert.match(workflow, /WLC_MAXIMUM_PER_PUBLISHER: "4"/);
  assert.match(workflow, /queue: max/);
  assert.match(workflow, /War & Security, World News, Politics & Society, Technology & AI, Science & Space, Business & Power, Culture & Entertainment, Sports & Soft Power/);
  assert.match(workflow, /draft-editorial-issues\.mjs/);
  assert.match(workflow, /refine-editorial-dialogue\.mjs/);
  assert.match(workflow, /Nothing publishes without owner approval/);
});

test("source configuration covers hard news and world-leader-adjacent desks", async () => {
  const config = JSON.parse(await read("config/news-sources.json"));
  const desks = new Set(config.sources.filter((source) => source.enabled).map((source) => source.desk));
  for (const required of [
    "World News",
    "US Politics & Society",
    "Technology & AI",
    "Science & Space",
    "Business & Power",
    "Culture & Entertainment",
    "Sports & Soft Power"
  ]) assert.ok(desks.has(required), `missing desk: ${required}`);
  assert.ok(config.maxCandidatesPerRun >= 12);
  assert.ok(config.relevance.adjacentPeopleTerms.includes("taylor swift"));
  assert.ok(config.relevance.adjacentPeopleTerms.includes("elon musk"));
});

test("drafting prompt preserves factual conclusions and forbids recycled stock chats", async () => {
  const entry = await read("scripts/draft-editorial-issues.mjs");
  const draft = await read("scripts/draft-editorial-issues-v2.mjs");
  assert.match(entry, /draft-editorial-issues-v2\.mjs/);
  assert.match(draft, /reader who opens the original links must reach the same factual conclusion/i);
  assert.match(draft, /Never invent an event, outcome, statistic, quotation, private communication, motive, meeting or source/);
  assert.match(draft, /Give credit to every listed publisher/);
  assert.match(draft, /10–14 messages/);
  assert.match(draft, /truth-first-sarcastic-news/);
  assert.match(draft, /strongest interpretation/);
  assert.match(draft, /Do not default to Trump, Macron, Meloni and Xi/);
  assert.match(draft, /Never mention Drake/);
  assert.match(draft, /dialogueProblems/);
  assert.match(draft, /bestArticleCandidate/);
  assert.match(draft, /Preserve a valid article\/headline/);
});

test("failed machine drafts stay newsroom work instead of becoming owner writing assignments", async () => {
  const editor = await read("editor/app.js");
  const queueWorkflow = await read(".github/workflows/draft-editorial-queue-now.yml");
  assert.match(editor, /No owner writing is needed/);
  assert.match(editor, /labels\.has\('needs-editor'\)/);
  assert.match(editor, /NEWSROOM PRODUCTION IN PROGRESS/);
  assert.match(queueWorkflow, /WLC_DRAFT_LIMIT: 50/);
});

test("future publication requires article-to-source and chat-quality verification", async () => {
  const validation = await read("scripts/lib/validation.mjs");
  const publish = await read("scripts/publish-from-issue.mjs");
  assert.match(validation, /articleMatchesSources must be true/);
  assert.match(validation, /articleProblems\(event\.article, event\.sources\)/);
  assert.match(validation, /Article standard:/);
  assert.match(validation, /Chat quality:/);
  assert.match(publish, /existingBundles: published\.map/);
});

test("Rewrite Chat preserves the article and replaces only dialogue", async () => {
  const workflow = await read(".github/workflows/editorial-regenerate.yml");
  const rewrite = await read("scripts/rewrite-chat-only.mjs");
  assert.match(workflow, /github\.event\.label\.name == 'regenerate-requested'/);
  assert.match(workflow, /WLC_TARGET_ISSUE/);
  assert.match(workflow, /rewrite-chat-only\.mjs/);
  assert.doesNotMatch(workflow, /copilot-requests|WLC_FORCE_REWRITE|draft-editorial-issues\.mjs/);
  assert.match(rewrite, /const originalArticle = structuredClone/);
  assert.match(rewrite, /bundle\.event\.article = originalArticle/);
  assert.match(rewrite, /bundle\.event\.messages = buildDirectDialogue/);
  assert.match(rewrite, /article and sources were preserved/);
});

test("article failures can request a complete source-locked redraft", async () => {
  const workflow = await read(".github/workflows/editorial-redraft.yml");
  const editor = await read("editor/app.js");
  assert.match(workflow, /github\.event\.label\.name == 'redraft-requested'/);
  assert.match(workflow, /copilot-requests: write/);
  assert.match(workflow, /WLC_FORCE_REWRITE: "1"/);
  assert.match(editor, /Regenerate Article \+ Chat/);
  assert.match(editor, /\['redraft-requested'\]/);
});

test("publication serializes main writes and finalizes labels without assuming optional labels exist", async () => {
  const workflow = await read(".github/workflows/editorial-publish.yml");
  const featured = await read(".github/workflows/featured-story.yml");
  assert.match(workflow, /github\.event\.label\.name == 'editorial-approved'[\s\S]*'world-leader-chat-main-writes' \|\| github\.run_id/);
  assert.match(featured, /github\.event\.label\.name == 'featured-headline'[\s\S]*'world-leader-chat-main-writes' \|\| github\.run_id/);
  assert.match(workflow, /queue: max/);
  assert.match(workflow, /labels_json=.*gh api/);
  assert.match(workflow, /select\(\. != "publication-failed"\)/);
  assert.match(workflow, /--method PUT "repos\/\$\{GITHUB_REPOSITORY\}\/issues\/\$\{ISSUE_NUMBER\}\/labels"/);
  assert.match(workflow, /gh issue close/);
  assert.match(workflow, /--add-label publication-failed/);
  assert.match(workflow, /--remove-label editorial-approved/);
  assert.match(workflow, /Retry Publish/);
});

test("editor adds fact-check first and approval second so only one publish event can win the race", async () => {
  const editor = await read("editor/app.js");
  assert.match(editor, /Summary must be 50–1200 characters/);
  assert.match(editor, /eventProblems\(bundle\)/);
  assert.match(editor, /articleProblems\(bundle\)/);
  assert.match(editor, /This file cannot publish yet/);
  const factCheckCall = editor.indexOf("setIssueLabels(updated, ['fact-checked']");
  const approvalCall = editor.indexOf("setIssueLabels(checked, ['editorial-approved']");
  assert.ok(factCheckCall >= 0 && approvalCall > factCheckCall);
});
