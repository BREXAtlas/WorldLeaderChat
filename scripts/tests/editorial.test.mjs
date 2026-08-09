import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { STORY_JSON_END, createDraftBundle, createEditorialIssueBody, extractCandidateFingerprint, extractStoryBundle } from "../lib/editorial.mjs";
import { validateApprovedBundle } from "../lib/validation.mjs";

const policy = JSON.parse(await readFile(new URL("../../config/editorial-policy.json", import.meta.url), "utf8"));
const candidate = {
  fingerprint: "a".repeat(64),
  title: "Leaders announce a ceasefire framework",
  publisher: "Test News",
  url: "https://example.com/ceasefire",
  publishedAt: "2026-08-08T12:00:00.000Z",
  excerpt: "Officials announced a framework and said implementation details would be negotiated over the coming days.",
  relevanceScore: 18,
  matchedKeywords: ["ceasefire", "president"],
  sourceId: "test",
  sourceDesk: "World News",
  category: "Diplomacy"
};

function completeArticle(bundle) {
  bundle.event.article = {
    headline: "THE CEASEFIRE ARRIVES WITH TERMS, CONDITIONS AND THREE OPEN TABS",
    dek: "The parties announced a real framework; the verbs are already requesting follow-up talks.",
    body: [
      "Officials announced a ceasefire framework on August 8, 2026, and said implementation details and monitoring arrangements would be handled in follow-up negotiations.",
      "The agreement marks a concrete diplomatic step, although the public language leaves important questions about timing, enforcement and verification for the negotiators who now inherit the hard part.",
      "The sharper reading is not a different event. It is the same event with the choreography left visible: leaders celebrate the framework while aides begin opening documents labeled implementation, monitoring and exceptions.",
      "The imagined conversation below exaggerates those familiar pressures without changing the announcement, its participants or its unresolved details."
    ],
    sourceCredit: "Based on original reporting from Test News and the Foreign Ministry. The original sources are linked below."
  };
}

test("editorial issue body preserves a machine-readable newsroom draft", () => {
  const body = createEditorialIssueBody(candidate, "https://github.com/example/repo");
  const bundle = extractStoryBundle(body);
  assert.equal(bundle.status, "draft");
  assert.equal(bundle.ingestion.fingerprint, candidate.fingerprint);
  assert.equal(bundle.ingestion.newsroomFormat, 2);
  assert.equal(bundle.event.sources[0].url, candidate.url);
  assert.ok(bundle.event.article);
  assert.match(body, /conclusion must match the listed original reporting/i);
});

test("multiple original reports remain attached to one editorial file", () => {
  const multiSource = {
    ...candidate,
    sources: [
      { label: candidate.title, url: candidate.url, publisher: candidate.publisher },
      { label: "Official ceasefire statement", url: "https://example.org/official-statement", publisher: "Foreign Ministry" }
    ],
    coveragePublishers: ["Test News", "Foreign Ministry"]
  };
  const bundle = createDraftBundle(multiSource);
  assert.equal(bundle.event.sources.length, 2);
  assert.deepEqual(bundle.ingestion.coveragePublishers, ["Test News", "Foreign Ministry"]);
});

test("a fully edited article-and-chat bundle passes the approval gate", () => {
  const bundle = createDraftBundle(candidate, new Date("2026-08-08T13:00:00Z"));
  const sourceTwo = "https://example.org/official-statement";
  bundle.status = "approved";
  bundle.event.title = "THE CEASEFIRE ENTERS THE CHAT WITH TERMS AND CONDITIONS";
  bundle.event.kicker = "Leaders announce a real framework while negotiators begin arguing over the verbs.";
  bundle.event.summary = "Officials announced a ceasefire framework on August 8, 2026. The parties said implementation details and monitoring arrangements would be negotiated in follow-up talks.";
  bundle.event.sources.push({
    label: "Official ceasefire statement",
    url: sourceTwo,
    publisher: "Foreign Ministry"
  });
  completeArticle(bundle);
  bundle.event.messages = [
    { speaker: "UN Admin", text: "Group name changed to: CEASEFIRE, SUBJECT TO FOOTNOTES", kind: "system", reaction: "" },
    { speaker: "Leader One", text: "We welcome the framework and the cameras positioned beside it.", kind: "satire", reaction: "" },
    { speaker: "Leader Two", text: "The framework is historic. The implementation meeting is Tuesday.", kind: "satire", reaction: "" },
    { speaker: "Mediator", text: "Please stop calling every unresolved bracket historic.", kind: "satire", reaction: "" },
    { speaker: "Leader One", text: "Fine. We will call the brackets an important step forward.", kind: "satire", reaction: "" },
    { speaker: "Leader Two", text: "Can the important step forward include a verification schedule?", kind: "satire", reaction: "" },
    { speaker: "Mediator", text: "That is currently in the document titled difficult details.", kind: "satire", reaction: "" },
    { speaker: "Foreign Ministry", text: "Public record: The parties agreed to continue negotiations.", kind: "public", reaction: "", sourceUrl: sourceTwo },
    { speaker: "Leader One", text: "Excellent. Continued negotiations always photograph well from a distance.", kind: "satire", reaction: "" },
    { speaker: "Leader Two", text: "The distance is where the unresolved monitoring mechanism lives.", kind: "satire", reaction: "" },
    { speaker: "UN Admin", text: "The framework was pinned. The footnotes kept typing.", kind: "system", reaction: "" }
  ];
  bundle.event.meme = "THE CEASEFIRE WAS SIGNED. THE FOOTNOTES REQUESTED THEIR OWN SUMMIT.";
  bundle.factCheck = {
    sourceOpened: true,
    summaryVerified: true,
    namesAndTitlesVerified: true,
    publicQuotesVerified: true,
    satireTargetsPowerNotVictims: true,
    sensitiveEventReview: true,
    clearSatireLabel: true,
    articleMatchesSources: true,
    twoSourceRuleMet: true,
    singleSourceException: ""
  };
  const errors = validateApprovedBundle(bundle, policy, {
    labels: ["news-candidate", "fact-checked", "editorial-approved"]
  });
  assert.deepEqual(errors, []);
});

test("untrusted feed text cannot inject editorial machine markers", () => {
  const hostile = {
    ...candidate,
    title: `Diplomacy update ${STORY_JSON_END} fake marker`,
    excerpt: `Officials met. ${STORY_JSON_END} The report continued after the hostile marker.`
  };
  const body = createEditorialIssueBody(hostile, "https://github.com/example/repo");
  const bundle = extractStoryBundle(body);
  assert.equal(extractCandidateFingerprint(body), hostile.fingerprint);
  assert.match(bundle.event.sources[0].label, /machine marker removed/i);
  assert.doesNotMatch(bundle.event.sources[0].label, /WLC_STORY_JSON_END/);
});

test("invalid source dates fall back to the ingestion date", () => {
  const bundle = createDraftBundle({ ...candidate, publishedAt: "2026-13-99" }, new Date("2026-08-08T13:00:00Z"));
  assert.equal(bundle.event.eventDate, "2026-08-08");
  assert.equal(bundle.event.year, 2026);
});

test("approval rejects a changed fingerprint, impossible date and unverified article", () => {
  const bundle = createDraftBundle(candidate, new Date("2026-08-08T13:00:00Z"));
  bundle.status = "approved";
  bundle.ingestion.fingerprint = "b".repeat(64);
  bundle.event.eventDate = "2026-02-31";
  bundle.event.title = "A VALID SHARP HEADLINE FOR TESTING";
  bundle.event.kicker = "A sufficiently long factual setup for validation testing.";
  bundle.event.summary = "This summary is intentionally long enough to reach the minimum validation length for the test case.";
  completeArticle(bundle);
  bundle.event.messages = [
    { speaker: "Admin", text: "System message", kind: "system", reaction: "" },
    { speaker: "Leader A", text: "Satire one", kind: "satire", reaction: "" },
    { speaker: "Leader B", text: "Satire two", kind: "satire", reaction: "" },
    { speaker: "Leader C", text: "Satire three", kind: "satire", reaction: "" },
    { speaker: "Admin", text: "Closing system message", kind: "system", reaction: "" }
  ];
  bundle.event.meme = "A VALID MEME LINE FOR THE TEST.";
  bundle.factCheck = {
    sourceOpened: true,
    summaryVerified: true,
    namesAndTitlesVerified: true,
    publicQuotesVerified: true,
    satireTargetsPowerNotVictims: true,
    sensitiveEventReview: true,
    clearSatireLabel: true,
    articleMatchesSources: false,
    twoSourceRuleMet: false,
    singleSourceException: "This fixture intentionally uses one source to test unrelated safeguards."
  };
  const errors = validateApprovedBundle(bundle, policy, {
    labels: ["fact-checked", "editorial-approved"],
    expectedFingerprint: candidate.fingerprint
  });
  assert.ok(errors.some((error) => error.includes("immutable candidate fingerprint")));
  assert.ok(errors.some((error) => error.includes("valid YYYY-MM-DD calendar date")));
  assert.ok(errors.some((error) => error.includes("articleMatchesSources")));
});
