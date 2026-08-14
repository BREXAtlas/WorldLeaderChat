import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("news ingestion runs four times daily, balances eight desks and drafts before approval", async () => {
  const workflow = await read(".github/workflows/news-ingestion.yml");
  assert.match(workflow, /cron: "20 7,11,15,19 \* \* \*"/);
  assert.match(workflow, /timezone: "America\/Chicago"/);
  assert.doesNotMatch(workflow, /copilot|models\.github/i);
  assert.match(workflow, /WLC_LOOKBACK_HOURS:.*168/);
  assert.match(workflow, /WLC_MINIMUM_SCORE:.*4/);
  assert.match(workflow, /WLC_MAX_CANDIDATES:.*8/);
  assert.match(workflow, /WLC_MINIMUM_PER_DESK: "1"/);
  assert.match(workflow, /WLC_MINIMUM_PUBLISHERS: "8"/);
  assert.match(workflow, /WLC_MINIMUM_PUBLISHERS_PER_DESK: "2"/);
  assert.match(workflow, /WLC_MAXIMUM_PER_PUBLISHER: "4"/);
  assert.match(workflow, /queue: max/);
  assert.match(workflow, /one current recommendation from every desk/);
  assert.match(workflow, /run-drafting-batches\.mjs/);
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
  assert.match(draft, /import \{ articleProblems, expectedSourceCredit, normalizeArticle \}/);
  assert.match(draft, /bestArticleCandidate/);
  assert.match(draft, /articleOnlySchema/);
  assert.match(draft, /chatDraftSchema/);
  assert.doesNotMatch(draft, /chatPlanSchema|messagesFromChatPlan|speakers\[index % speakers\.length\]/);
  assert.match(draft, /draftAuditSchema/);
  assert.match(draft, /auditGeneratedDraft/);
  assert.match(draft, /Source audit chat/);
  assert.match(draft, /acceptedArticleOutput/);
  assert.match(draft, /Never promote fill-in-the-headline copy as a safety fallback/);
});

test("failed machine drafts stay newsroom work instead of becoming owner writing assignments", async () => {
  const editor = await read("editor/app.js");
  const queueWorkflow = await read(".github/workflows/draft-editorial-queue-now.yml");
  assert.match(editor, /No owner writing is needed/);
  assert.match(editor, /labels\.has\('needs-editor'\)/);
  assert.match(editor, /NEWSROOM PRODUCTION IN PROGRESS/);
  assert.match(editor, /Finish Today’s Drafts/);
  assert.match(editor, /\['draft-batch-requested'\]/);
  assert.doesNotMatch(editor, /actions\/workflows\/draft-editorial-queue-now\.yml\/dispatches/);
  assert.match(queueWorkflow, /issues:[\s\S]*types: \[labeled\]/);
  assert.match(queueWorkflow, /github\.event\.label\.name == 'draft-batch-requested'/);
  assert.match(queueWorkflow, /Clear the editor issue trigger/);
  assert.match(queueWorkflow, /group: .*draft-batch-requested.*world-leader-chat-editorial-production.*github\.run_id/);
  assert.match(queueWorkflow, /WLC_DRAFT_BATCH_SIZE: "10"/);
  assert.match(queueWorkflow, /WLC_DAILY_DRAFT_LIMIT: "30"/);
  assert.match(queueWorkflow, /run-drafting-batches\.mjs/);
  assert.match(queueWorkflow, /target_issue/);
  assert.match(queueWorkflow, /WLC_TARGET_ISSUE/);
  assert.match(queueWorkflow, /Refresh the selected custom article source/);
  assert.match(queueWorkflow, /enrich-custom-submission\.mjs/);
  assert.match(queueWorkflow, /Confirm the selected file or report the later-batch backlog/);
  assert.match(queueWorkflow, /assert-editorial-readiness\.mjs/);
});

test("owner-queued drafts run before quarantined model retries", async () => {
  const draft = await read("scripts/draft-editorial-issues-v2.mjs");
  assert.match(draft, /function draftingPriority/);
  assert.match(draft, /redraft-requested[\s\S]*regenerate-requested[\s\S]*return 0/);
  assert.match(draft, /needs-editor[\s\S]*return 2/);
  assert.match(draft, /sort\(\(left, right\) => draftingPriority/);
});

test("every scheduled sweep continues through the current-day writing queue", async () => {
  const workflow = await read(".github/workflows/news-ingestion.yml");
  const draft = await read("scripts/draft-editorial-issues-v2.mjs");
  const opening = await read("scripts/open-editorial-issues.mjs");
  const batches = await read("scripts/run-drafting-batches.mjs");
  const readiness = await read("scripts/assert-editorial-readiness.mjs");
  assert.match(workflow, /WLC_DRAFT_BATCH_SIZE: "10"/);
  assert.match(workflow, /WLC_DAILY_DRAFT_LIMIT: "30"/);
  assert.match(workflow, /WLC_DAILY_CANDIDATE_LIMIT: "30"/);
  assert.match(workflow, /} >> "\$GITHUB_STEP_SUMMARY"\s+node scripts\/report-ingestion-summary\.mjs/);
  assert.doesNotMatch(workflow, /key: wlc-local-writer[^\n]*\n\s+node /);
  assert.match(workflow, /WLC_TODAY_ONLY: "1"/);
  assert.match(workflow, /Report the files retained for later writing batches/);
  assert.match(workflow, /WLC_ALLOW_BACKLOG: "1"/);
  assert.match(draft, /todayOnly/);
  assert.match(draft, /daily-overflow/);
  assert.match(opening, /WLC_DAILY_CANDIDATE_LIMIT \|\| 30/);
  assert.match(opening, /dailyCounts/);
  assert.match(batches, /WLC_DRAFT_BATCH_SIZE \|\| 10/);
  assert.match(batches, /WLC_DAILY_DRAFT_LIMIT \|\| 30/);
  assert.match(batches, /while \(attemptedIssues\.size < runLimit\)/);
  assert.match(batches, /WLC_DRAFT_RESULT_PATH/);
  assert.match(batches, /WLC_SKIP_ISSUES/);
  assert.match(batches, /selected\.length < limit/);
  assert.match(draft, /skippedIssueNumbers/);
  assert.match(draft, /selectedIssueNumbers: queue\.map/);
  assert.match(workflow, /groups of at most 10 continue automatically/);
  assert.match(readiness, /remain outside Ready for Approval for later batches/);
  assert.match(readiness, /daily-overflow/);
});

test("all editorial drafting workflows share one non-cancelling production lock", async () => {
  const workflows = await Promise.all([
    read(".github/workflows/news-ingestion.yml"),
    read(".github/workflows/draft-editorial-queue-now.yml"),
    read(".github/workflows/editorial-redraft.yml"),
    read(".github/workflows/editorial-regenerate.yml")
  ]);
  for (const workflow of workflows) {
    assert.match(workflow, /group: .*world-leader-chat-editorial-production/);
    assert.match(workflow, /cancel-in-progress: false/);
    assert.match(workflow, /start-local-newsroom-writer\.sh/);
    assert.doesNotMatch(workflow, /copilot|models\.github/i);
  }
});

test("future publication requires article-to-source and chat-quality verification", async () => {
  const validation = await read("scripts/lib/validation.mjs");
  const publish = await read("scripts/publish-from-issue.mjs");
  assert.match(validation, /articleMatchesSources must be true/);
  assert.match(validation, /articleProblems\(event\.article, event\.sources\)/);
  assert.match(validation, /Article standard:/);
  assert.match(validation, /Chat quality:/);
  assert.match(publish, /existingBundles: published\.map/);
  assert.match(publish, /assignRelatedEventGroup\(event, published\)/);
  assert.match(publish, /Cross-referenced/);
});

test("Rewrite Chat preserves the article and replaces only dialogue", async () => {
  const workflow = await read(".github/workflows/editorial-regenerate.yml");
  const rewrite = await read("scripts/rewrite-chat-only.mjs");
  assert.match(workflow, /github\.event\.label\.name == 'regenerate-requested'/);
  assert.match(workflow, /github\.event\.label\.name == 'regenerate-requested'[\s\S]*world-leader-chat-editorial-production[\s\S]*github\.run_id/);
  assert.match(workflow, /WLC_TARGET_ISSUE/);
  assert.match(workflow, /rewrite-chat-only\.mjs/);
  assert.match(workflow, /start-local-newsroom-writer\.sh/);
  assert.doesNotMatch(workflow, /copilot|models\.github/i);
  assert.doesNotMatch(workflow, /WLC_FORCE_REWRITE|draft-editorial-issues\.mjs/);
  assert.match(rewrite, /const originalArticle = structuredClone/);
  assert.match(rewrite, /bundle\.event\.article = originalArticle/);
  assert.match(rewrite, /runNewsroomJson/);
  assert.match(rewrite, /Never write “I read \[headline\]”/);
  assert.doesNotMatch(rewrite, /buildDirectDialogue/);
  assert.match(rewrite, /article and sources were preserved/);
});

test("failed generation cannot promote a recycled deterministic fallback to owner review", async () => {
  const draft = await read("scripts/draft-editorial-issues-v2.mjs");
  const dialogue = await read("scripts/lib/newsroom-dialogue.mjs");
  assert.doesNotMatch(draft, /deterministicDraft|Deterministic safety draft/);
  assert.match(draft, /generation failure\(s\) kept out of review/);
  assert.doesNotMatch(dialogue, /I read \$\{headline\}/);
  assert.match(dialogue, /original dialogue generation is required/);
});

test("article failures can request a complete source-locked redraft", async () => {
  const workflow = await read(".github/workflows/editorial-redraft.yml");
  const editor = await read("editor/app.js");
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /target_issue:/);
  assert.doesNotMatch(workflow, /types: \[labeled\]/);
  assert.match(workflow, /WLC_TARGET_ISSUE: \$\{\{ inputs\.target_issue \}\}/);
  assert.match(workflow, /start-local-newsroom-writer\.sh/);
  assert.doesNotMatch(workflow, /copilot|models\.github/i);
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
  assert.match(editor, /lengthRule\('Summary', event\.summary, 50, 1200\)/);
  assert.match(editor, /lengthRule\('Kicker', event\.kicker, 10, 320\)/);
  assert.match(editor, /eventProblems\(bundle\)/);
  assert.match(editor, /articleProblems\(bundle\)/);
  assert.match(editor, /This file cannot publish yet/);
  const factCheckCall = editor.indexOf("setIssueLabels(updated, ['fact-checked']");
  const approvalCall = editor.indexOf("setIssueLabels(checked, ['editorial-approved']");
  assert.ok(factCheckCall >= 0 && approvalCall > factCheckCall);
});

test("drafting and editor enforce the publication kicker rule before owner approval", async () => {
  const model = await read("scripts/lib/newsroom-model.mjs");
  const draft = await read("scripts/draft-editorial-issues-v2.mjs");
  const editor = await read("editor/app.js");
  assert.match(model, /kicker: \{ type: "string", minLength: 10, maxLength: 320 \}/);
  assert.match(draft, /lengthRule\("kicker", event\.kicker, 10, 320\)/);
  assert.match(editor, /lengthRule\('Kicker', event\.kicker, 10, 320\)/);
});
