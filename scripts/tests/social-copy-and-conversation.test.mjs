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

test("editor does not append generic stock conversations in the browser", async () => {
  const upgrade = await read("editor/conversation-upgrade.js");
  assert.match(upgrade, /targetMessageCount: "10-14"/);
  assert.match(upgrade, /article-specific direct back-and-forth/);
  assert.match(upgrade, /browserGeneratedDialogue: false/);
  assert.doesNotMatch(upgrade, /result\.event\.messages = \[\.\.\.result\.event\.messages/);
  assert.doesNotMatch(upgrade, /strongest message|record has asked not to be involved/i);
});

test("newsroom editor presents saved articles without synthesizing dialogue", async () => {
  const newsroomEditor = await read("editor/newsroom-upgrade.js");
  const app = await read("editor/app.js");
  assert.match(newsroomEditor, /never manufactures or rewrites dialogue/i);
  assert.match(app, /SHORT ARTICLE PREVIEW/);
  assert.doesNotMatch(newsroomEditor, /fallbackSuggestion\s*=/);
});

test("editor blocks recycled stock lines and named meme templates", async () => {
  const editor = await read("editor/app.js");
  assert.match(editor, /strongest interpretation/);
  assert.match(editor, /I have thoughts/i);
  assert.match(editor, /STOCK_MEME/);
  assert.match(editor, /Rewrite Chat/);
  assert.match(editor, /regenerate-requested/);
  assert.doesNotMatch(editor, /function fallbackSuggestion/);
});

test("public newsroom keeps three-column current coverage and older-year dropdowns", async () => {
  const newsroom = await read("newsroom-site.js");
  assert.match(newsroom, /CURRENT FILES/);
  assert.match(newsroom, /ARCHIVE \/\/ 2020–2025/);
  assert.match(newsroom, /details class="year-archive"/);
  assert.match(newsroom, /grid-template-columns:repeat\(3/);
  assert.match(newsroom, /Technology & AI/);
  assert.match(newsroom, /Culture & Entertainment/);
  assert.match(newsroom, /THE SHORT REPORT/);
});

test("current files own the full page width before stacked archive dropdowns", async () => {
  const polish = await read("disclosure-polish.js");
  assert.match(polish, /#archive\.archive\{[\s\S]*display:block!important/);
  assert.match(polish, /#archive > \.current-news,[\s\S]*#archive > \.archive-heading,[\s\S]*#archive > details\.year-archive/);
  assert.match(polish, /grid-column:1\/-1!important/);
  assert.match(polish, /\.current-columns,\.archive-year-grid\{[\s\S]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/);
});

test("Pages build includes social, newsroom, rolling archive and editor assets", async () => {
  const build = await read("scripts/build-site.mjs");
  assert.match(build, /social-tools\.js/);
  assert.match(build, /newsroom-site\.js/);
  assert.match(build, /rolling-archive\.js/);
  assert.match(build, /conversation-upgrade\.js/);
  assert.match(build, /newsroom-upgrade\.js/);
});
