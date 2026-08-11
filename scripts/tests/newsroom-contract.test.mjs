import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { articleProblems, expectedSourceCredit, normalizeArticle } from "../lib/article-standard.mjs";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const sources = [
  { publisher: "Reuters", url: "https://example.com/reuters" },
  { publisher: "Associated Press", url: "https://example.com/ap" }
];
const paragraphs = [
  "Ministers opened emergency talks after the verified announcement changed the timetable and forced agencies to explain what happens next. The first round produced no final agreement, but it did establish the questions officials now have to answer in public.",
  "The linked reports agree on the central sequence, the people involved and the immediate consequences. They also show where details remain unsettled, so this report keeps those limits visible instead of giving uncertainty a dramatic costume and calling it confidence.",
  "That gap between the formal statement and the practical fallout is why the chat matters. The imagined reactions add a dry view of the political incentives, while the factual account remains tied to the sources and leaves the invented bravado inside the bubbles."
];

test("article standard requires a readable source-locked short report", () => {
  const article = { headline: "A factual headline", dek: "A concise factual deck.", body: paragraphs, sourceCredit: expectedSourceCredit(sources) };
  assert.deepEqual(articleProblems(article, sources), []);
  assert.match(article.sourceCredit, /Reuters and Associated Press/);
  assert.ok(article.body.join(" ").split(/\s+/).length >= 100);

  const tooShort = { ...article, body: paragraphs.slice(0, 2) };
  assert.ok(articleProblems(tooShort, sources).some((problem) => problem.includes("3–5 paragraphs")));
  const wrongCredit = { ...article, sourceCredit: "Based on original reporting from Reuters and The Imaginary Times." };
  assert.ok(articleProblems(wrongCredit, sources).some((problem) => problem.includes("exactly the publishers")));
});

test("normalization removes stray credit paragraphs but never invents prose", () => {
  const article = {
    headline: "Headline",
    dek: "Dek",
    body: [...paragraphs, "Credit: Reuters"],
    sourceCredit: "Based on original reporting from Reuters and an unlinked publisher."
  };
  const normalized = normalizeArticle(article, sources);
  assert.deepEqual(normalized.body, paragraphs);
  assert.equal(normalized.sourceCredit, expectedSourceCredit(sources));
  assert.deepEqual(article.body, [...paragraphs, "Credit: Reuters"]);
});

test("contract preserves every public copy and social action", async () => {
  const source = await read("newsroom-contract.js");
  const context = vm.createContext({});
  vm.runInContext(source, context);
  assert.deepEqual(Array.from(context.WLC_NEWSROOM_CONTRACT.requiredArticleActions), [
    "Copy Article + Chat",
    "Copy Social Version",
    "Save Social PNG",
    "Share Social PNG",
    "Save Social Carousel",
    "Share Social Carousel"
  ]);
});

test("editor and CI enforce the versioned newsroom contract", async () => {
  const [editor, workflow, guard, rules, codeowners] = await Promise.all([
    read("editor/app.js"),
    read(".github/workflows/ci.yml"),
    read("scripts/check-newsroom-structure-approval.mjs"),
    read("docs/NEWSROOM_RULES.md"),
    read(".github/CODEOWNERS")
  ]);
  assert.match(editor, /COMPLETE SHORT REPORT/);
  assert.match(editor, /This file cannot publish yet/);
  assert.match(workflow, /owner approval for newsroom structure/i);
  assert.match(guard, /owner-approved-structure/);
  assert.match(rules, /August 11, 2026, August 3 files are archived/);
  assert.match(codeowners, /\/rolling-archive\.js @BREXAtlas/);
});
