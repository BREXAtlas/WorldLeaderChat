import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("public site ships article, full-chat and social-copy controls", async () => {
  const social = await read("social-tools.js");
  assert.match(social, /Copy Article \+ Chat/);
  assert.match(social, /Copy Social Version/);
  assert.match(social, /REAL EVENT\. ORIGINAL SOURCES LINKED\. PRIVATE REACTIONS IMAGINED/);
  assert.match(social, /PUBLIC RECORD/);
  assert.match(social, /THE SHORT REPORT/);
});

test("editor upgrades generated conversations to longer back-and-forth drafts", async () => {
  const upgrade = await read("editor/conversation-upgrade.js");
  assert.match(upgrade, /targetMessageCount: "10-14"/);
  assert.match(upgrade, /back-and-forth/);
  assert.match(upgrade, /result\.event\.messages = \[\.\.\.result\.event\.messages, \.\.\.additions\]/);
});

test("newsroom editor requires a sourced article before future approval", async () => {
  const newsroomEditor = await read("editor/newsroom-upgrade.js");
  assert.match(newsroomEditor, /articleMatchesSources/);
  assert.match(newsroomEditor, /truth-first-sarcastic-news/);
  assert.match(newsroomEditor, /SHORT ARTICLE PREVIEW/);
});

test("public newsroom puts 2026 across three columns and archives older years", async () => {
  const newsroom = await read("newsroom-site.js");
  assert.match(newsroom, /2026 \/\/ CURRENT FILES/);
  assert.match(newsroom, /ARCHIVE \/\/ 2020–2025/);
  assert.match(newsroom, /details class="year-archive"/);
  assert.match(newsroom, /grid-template-columns:repeat\(3/);
  assert.match(newsroom, /Technology & AI/);
  assert.match(newsroom, /Culture & Entertainment/);
  assert.match(newsroom, /THE SHORT REPORT/);
});

test("Pages build includes social, newsroom and editor article assets", async () => {
  const build = await read("scripts/build-site.mjs");
  assert.match(build, /social-tools\.js/);
  assert.match(build, /newsroom-site\.js/);
  assert.match(build, /conversation-upgrade\.js/);
  assert.match(build, /newsroom-upgrade\.js/);
});
