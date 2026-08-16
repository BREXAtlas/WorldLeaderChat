import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

await import("../../custom-submission.js");
const custom = globalThis.WLC_CUSTOM_SUBMISSION;
const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("custom submission builds a source-locked editorial file from links and notes", async () => {
  const bundle = await custom.createBundle({
    topic: "Trump responds to newly publicized Fauci phone records",
    desk: "Politics & Society",
    urls: [
      "https://youtu.be/580LcDQ0dGI",
      "https://www.cnn.com/2026/08/05/politics/fauci-phone-obtained-senate-subcommittee"
    ],
    notes: "A reporter asked President Trump about newly publicized Fauci messages. Trump called the Biden administration a disaster without addressing the underlying medical allegation in detail."
  }, new Date("2026-08-11T05:30:00Z"));

  assert.equal(bundle.ingestion.customSubmission, true);
  assert.equal(bundle.ingestion.newsroomDesk, "Politics & Society");
  assert.equal(bundle.event.eventDate, "2026-08-11");
  assert.equal(bundle.event.sources.length, 2);
  assert.equal(bundle.event.sources[0].publisher, "YouTube");
  assert.match(bundle.ingestion.fingerprint, /^[a-f0-9]{64}$/);
  assert.match(bundle.event.article.body[0], /Generate a complete 3–5 paragraph/);

  const body = custom.issueBody(bundle);
  assert.match(body, /WLC_CUSTOM_SUBMISSION/);
  assert.match(body, /WLC_STORY_JSON_START/);
  assert.match(body, /Nothing publishes until the owner approves/);
  assert.doesNotMatch(body, /github_pat_|Bearer /);
});

test("custom submission rejects unsafe or incomplete input", () => {
  const invalid = custom.validate({ topic: "Too short", desk: "Politics & Society", urls: ["http://localhost/private"], notes: "tiny" });
  assert.ok(invalid.problems.some((problem) => /12–180/.test(problem)));
  assert.ok(invalid.problems.some((problem) => /40–2400/.test(problem)));
  assert.ok(invalid.problems.some((problem) => /public HTTPS/.test(problem)));
});

test("editor exposes an accessible custom-link generator and queues the existing drafting workflow", async () => {
  const [html, app, workflow] = await Promise.all([
    read("editor/index.html"),
    read("editor/app.js"),
    read(".github/workflows/draft-editorial-queue-now.yml")
  ]);
  assert.match(html, /Generate a custom article from links/);
  assert.match(html, /id="customTopic"/);
  assert.match(html, /id="customUrls"/);
  assert.match(html, /id="customNotes"/);
  assert.match(html, /role="status" aria-live="polite"/);
  assert.match(app, /WLC_CUSTOM_SUBMISSION\.createBundle/);
  assert.match(app, /labels: \['news-candidate', 'redraft-requested'\]/);
  assert.match(workflow, /node scripts\/enrich-custom-submission\.mjs[\s\S]*node scripts\/draft-editorial-issues\.mjs/);
});

test("source enrichment blocks private-network fetches and caps remote content", async () => {
  const source = await read("scripts/enrich-custom-submission.mjs");
  assert.match(source, /assertPublicHttps/);
  assert.match(source, /blockedAddress/);
  assert.match(source, /a === 127/);
  assert.match(source, /a === 169 && b === 254/);
  assert.match(source, /total > 2_000_000/);
  assert.match(source, /redirects >= 3/);
  assert.match(source, /controller\.abort/);
});

test("Pages packages and smoke-checks the custom submission generator", async () => {
  const [build, deploy] = await Promise.all([
    read("scripts/build-site.mjs"),
    read(".github/workflows/deploy-pages.yml")
  ]);
  assert.match(build, /custom-submission\.js/);
  assert.match(deploy, /Generate a custom article from links/);
  assert.match(deploy, /WLC_CUSTOM_SUBMISSION/);
});
