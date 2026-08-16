import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { STORY_JSON_END, STORY_JSON_START } from "../lib/editorial.mjs";
import { selectEditorialWork } from "../lib/editorial-worker-queue.mjs";
import { zeroYieldFailure } from "../lib/editorial-run-result.mjs";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

function candidate(number, labels, eventDate = "2026-08-16") {
  const bundle = {
    schemaVersion: 1,
    ingestion: { newsroomFormat: 2 },
    event: {
      id: `event-${number}`,
      eventDate,
      title: `Specific event ${number}`,
      article: { headline: `Specific event ${number}`, dek: "A sourced event summary long enough for a test fixture.", body: ["One.", "Two.", "Three."], sourceCredit: "Based on original reporting from Test." },
      sources: [],
      messages: []
    }
  };
  return {
    number,
    labels: labels.map((name) => ({ name })),
    body: `${STORY_JSON_START}\n\`\`\`json\n${JSON.stringify(bundle)}\n\`\`\`\n${STORY_JSON_END}`
  };
}

test("one worker coalesces every durable article and chat request", () => {
  const result = selectEditorialWork([
    candidate(11, ["news-candidate", "redraft-requested"], "2026-08-15"),
    candidate(12, ["news-candidate", "regenerate-requested"], "2026-08-14"),
    candidate(13, ["news-candidate", "ready-for-approval"])
  ], { today: "2026-08-16", forceBatch: false, limit: 20 });
  assert.deepEqual(result.selected, [{ issue: 11, action: "article" }, { issue: 12, action: "chat" }]);
  assert.equal(result.remaining, 0);
});

test("a Finish Today request selects only unfinished current-day files plus explicit older requests", () => {
  const result = selectEditorialWork([
    candidate(20, ["news-candidate", "draft-batch-requested"]),
    candidate(21, ["news-candidate", "needs-editor"]),
    candidate(22, ["news-candidate", "ready-for-approval"]),
    candidate(23, ["news-candidate", "needs-editor"], "2026-08-15"),
    candidate(24, ["news-candidate", "redraft-requested"], "2026-08-15")
  ], { today: "2026-08-16", todayOnly: true, limit: 20 });
  assert.deepEqual(result.selected.map((item) => item.issue), [24, 20, 21]);
});

test("the worker preserves the twenty-file ceiling and reports remaining work", () => {
  const issues = Array.from({ length: 23 }, (_, index) => candidate(100 + index, ["news-candidate", "redraft-requested"]));
  const result = selectEditorialWork(issues, { today: "2026-08-16", limit: 20 });
  assert.equal(result.selected.length, 20);
  assert.equal(result.remaining, 3);
});

test("a writing run that attempts files but prepares none for review is a failure", () => {
  assert.equal(zeroYieldFailure(12, 0), true);
  assert.equal(zeroYieldFailure(12, 1), false);
  assert.equal(zeroYieldFailure(0, 0), false);
});

test("production has one durable parallel editorial worker and intake cannot hold its lock", async () => {
  const [worker, intake] = await Promise.all([
    read(".github/workflows/draft-editorial-queue-now.yml"),
    read(".github/workflows/news-ingestion.yml")
  ]);
  assert.match(worker, /queue: max/);
  assert.match(worker, /regenerate-requested/);
  assert.match(worker, /redraft-requested/);
  assert.match(worker, /max-parallel: 4/);
  assert.match(worker, /Prove this file reached Ready for Approval/);
  assert.match(worker, /Fail visibly when any selected file did not become ready/);
  assert.doesNotMatch(intake, /world-leader-chat-editorial-production/);
  assert.doesNotMatch(intake, /start-local-newsroom-writer|run-drafting-batches/);
  assert.match(intake, /gh workflow run draft-editorial-queue-now\.yml/);
});
