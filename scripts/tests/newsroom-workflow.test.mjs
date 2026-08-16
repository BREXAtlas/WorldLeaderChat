import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("news ingestion runs four times daily, balances eight desks and hands off without holding the writer", async () => {
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
  assert.match(workflow, /gh workflow run draft-editorial-queue-now\.yml/);
  assert.doesNotMatch(workflow, /run-drafting-batches\.mjs|start-local-newsroom-writer/);
  assert.doesNotMatch(workflow, /world-leader-chat-editorial-production/);
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
  assert.match(draft, /articleOnlySchema/);
  assert.match(draft, /chatDraftSchema/);
  assert.match(draft, /valid JSON with participants, messages, closingLine and reviewNotes/);
  assert.match(draft, /meme: closingLine/);
  assert.match(draft, /materializeChatDraft/);
  assert.match(draft, /sourceSummary\.length >= 50 \? sourceSummary : generatedSummary/);
  assert.match(draft, /stabilizeGeneratedConversation/);
  assert.doesNotMatch(draft, /chatPlanSchema|messagesFromChatPlan|speakers\[index % speakers\.length\]/);
  assert.match(draft, /draftAuditSchema/);
  assert.match(draft, /auditGeneratedDraft/);
  assert.match(draft, /Source audit chat/);
  assert.match(draft, /acceptedArticleOutput/);
  assert.match(draft, /Do not save any "best" failed attempt or expose it for owner approval/);
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
  assert.match(queueWorkflow, /Clear completed Finish Today batch markers/);
  assert.match(queueWorkflow, /group: world-leader-chat-editorial-production/);
  assert.match(queueWorkflow, /queue: max/);
  assert.match(queueWorkflow, /max-parallel: 4/);
  assert.match(queueWorkflow, /WLC_WORKER_LIMIT: "20"/);
  assert.match(queueWorkflow, /prepare-editorial-worker\.mjs/);
  assert.match(queueWorkflow, /target_issue/);
  assert.match(queueWorkflow, /WLC_TARGET_ISSUE/);
  assert.match(queueWorkflow, /Refresh owner-submitted source material/);
  assert.match(queueWorkflow, /enrich-custom-submission\.mjs/);
  assert.match(queueWorkflow, /Recover only this interrupted file/);
  assert.match(queueWorkflow, /recover-interrupted-drafts\.mjs/);
  assert.match(queueWorkflow, /Prove this file reached Ready for Approval/);
  assert.match(queueWorkflow, /assert-editorial-readiness\.mjs/);
});

test("owner-queued drafts run before quarantined model retries", async () => {
  const draft = await read("scripts/draft-editorial-issues-v2.mjs");
  assert.match(draft, /function draftingPriority/);
  assert.match(draft, /redraft-requested[\s\S]*regenerate-requested[\s\S]*return 0/);
  assert.match(draft, /needs-editor[\s\S]*return 2/);
  assert.match(draft, /sort\(\(left, right\) => draftingPriority/);
});

test("scheduled intake dispatches the durable twenty-file writing queue", async () => {
  const workflow = await read(".github/workflows/news-ingestion.yml");
  const draft = await read("scripts/draft-editorial-issues-v2.mjs");
  const opening = await read("scripts/open-editorial-issues.mjs");
  const batches = await read("scripts/run-drafting-batches.mjs");
  const readiness = await read("scripts/assert-editorial-readiness.mjs");
  assert.match(workflow, /WLC_DAILY_CANDIDATE_LIMIT: "20"/);
  assert.match(workflow, /} >> "\$GITHUB_STEP_SUMMARY"\s+node scripts\/report-ingestion-summary\.mjs/);
  assert.doesNotMatch(workflow, /key: wlc-local-writer[^\n]*\n\s+node /);
  assert.match(workflow, /gh workflow run draft-editorial-queue-now\.yml[\s\S]*today_only=true/);
  assert.match(draft, /todayOnly/);
  assert.match(draft, /daily-overflow/);
  assert.match(opening, /WLC_DAILY_CANDIDATE_LIMIT \|\| 20/);
  assert.match(opening, /dailyCounts/);
  assert.match(batches, /WLC_DRAFT_BATCH_SIZE \|\| 10/);
  assert.match(batches, /WLC_DAILY_DRAFT_LIMIT \|\| 30/);
  assert.match(batches, /while \(attemptedIssues\.size < runLimit\)/);
  assert.match(batches, /WLC_DRAFT_RESULT_PATH/);
  assert.match(batches, /WLC_SKIP_ISSUES/);
  assert.match(batches, /selected\.length < limit/);
  assert.match(draft, /skippedIssueNumbers/);
  assert.match(draft, /selectedIssueNumbers: queue\.map/);
  assert.match(workflow, /up to four files written in parallel/);
  assert.match(readiness, /remain outside Ready for Approval for later batches/);
  assert.match(readiness, /daily-overflow/);
});

test("one non-cancelling production worker owns every article and chat request", async () => {
  const workflow = await read(".github/workflows/draft-editorial-queue-now.yml");
  assert.match(workflow, /group: world-leader-chat-editorial-production/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /queue: max/);
  assert.match(workflow, /draft-batch-requested/);
  assert.match(workflow, /redraft-requested/);
  assert.match(workflow, /regenerate-requested/);
  assert.match(workflow, /start-local-newsroom-writer\.sh/);
  assert.doesNotMatch(workflow, /copilot|models\.github/i);
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
  const workflow = await read(".github/workflows/draft-editorial-queue-now.yml");
  const rewrite = await read("scripts/rewrite-chat-only.mjs");
  assert.match(workflow, /github\.event\.label\.name == 'regenerate-requested'/);
  assert.match(workflow, /github\.event\.label\.name == 'regenerate-requested'/);
  assert.match(workflow, /WLC_TARGET_ISSUE/);
  assert.match(workflow, /rewrite-chat-only\.mjs/);
  assert.match(workflow, /start-local-newsroom-writer\.sh/);
  assert.doesNotMatch(workflow, /copilot|models\.github/i);
  assert.match(workflow, /if: matrix\.action == 'chat'[\s\S]*rewrite-chat-only\.mjs/);
  assert.match(workflow, /if: matrix\.action == 'article'[\s\S]*draft-editorial-issues\.mjs/);
  assert.match(rewrite, /const originalArticle = structuredClone/);
  assert.match(rewrite, /bundle\.event\.article = originalArticle/);
  assert.match(rewrite, /runNewsroomJson/);
  assert.match(rewrite, /keys participants, messages, closingLine and reviewNotes/);
  assert.match(rewrite, /output\.closingLine/);
  assert.match(rewrite, /materializeChatDraft/);
  assert.match(rewrite, /stabilizeGeneratedConversation/);
  assert.match(rewrite, /Never write “I read \[headline\]”/);
  assert.doesNotMatch(rewrite, /buildDirectDialogue/);
  assert.match(rewrite, /article and sources were preserved/);
});

test("failed generation cannot promote a recycled deterministic fallback to owner review", async () => {
  const draft = await read("scripts/draft-editorial-issues-v2.mjs");
  const dialogue = await read("scripts/lib/newsroom-dialogue.mjs");
  assert.doesNotMatch(draft, /deterministicDraft|Deterministic safety draft/);
  assert.doesNotMatch(draft, /bestArticleCandidate/);
  assert.match(draft, /if \(!writerWorked\) \{[\s\S]*?recordDraftFailure[\s\S]*?setLabels\(failedIssue, \["needs-editor"\][\s\S]*?continue;[\s\S]*?\}\s*\n\s*const finalProblems/);
  assert.match(draft, /generation failure\(s\) kept out of review/);
  assert.doesNotMatch(dialogue, /I read \$\{headline\}/);
  assert.match(dialogue, /original dialogue generation is required/);
});

test("article failures can request a complete source-locked redraft", async () => {
  const workflow = await read(".github/workflows/draft-editorial-queue-now.yml");
  const editor = await read("editor/app.js");
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /target_issue:/);
  assert.match(workflow, /types: \[labeled\]/);
  assert.match(workflow, /WLC_TARGET_ISSUE:/);
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

test("known newsroom failures remain documented and machine-guarded", async () => {
  const ledger = await read("docs/NEWSROOM_FAILURE_LEDGER.md");
  const recovery = await read("scripts/recover-interrupted-drafts.mjs");
  const workflows = await Promise.all([
    read(".github/workflows/draft-editorial-queue-now.yml"),
    read(".github/workflows/news-ingestion.yml")
  ]);
  for (const id of ["WLC-001", "WLC-003", "WLC-004", "WLC-005", "WLC-006", "WLC-007", "WLC-008", "WLC-009", "WLC-010", "WLC-011", "WLC-020", "WLC-021", "WLC-022"]) {
    assert.match(ledger, new RegExp(id));
  }
  assert.match(ledger, /A green workflow with zero ready articles does not count/);
  assert.match(recovery, /labels\.delete\("drafting"\)/);
  assert.match(recovery, /labels\.add\("needs-editor"\)/);
  assert.match(workflows[0], /recover-interrupted-drafts\.mjs/);
  assert.doesNotMatch(workflows[1], /recover-interrupted-drafts\.mjs/);
});
