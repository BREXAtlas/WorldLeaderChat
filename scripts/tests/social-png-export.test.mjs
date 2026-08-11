import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("social PNG exporter supports feed, story/TikTok and X/Facebook sizes", async () => {
  const source = await read("social-card-export.js");
  assert.match(source, /width: 1080,\s*height: 1350/);
  assert.match(source, /width: 1080,\s*height: 1920/);
  assert.match(source, /width: 1600,\s*height: 900/);
  assert.match(source, /Instagram \/ Facebook Feed \(4:5\)/);
  assert.match(source, /Story \/ TikTok \(9:16\)/);
  assert.match(source, /X \/ Facebook Landscape \(16:9\)/);
});

test("every article detail receives save and native-share PNG controls", async () => {
  const source = await read("social-card-export.js");
  assert.match(source, /document\.querySelector\("\.detail-actions"\)/);
  assert.match(source, /Save Social PNG/);
  assert.match(source, /Share Social PNG/);
  assert.match(source, /currentEvent\(\)/);
  assert.match(source, /allEvents\(\)\.find/);
  assert.match(source, /navigator\.share/);
  assert.match(source, /canvas\.toBlob/);
  assert.match(source, /downloadBlob/);
});

test("social cards use a consistent branded background and source attribution", async () => {
  const source = await read("social-card-export.js");
  assert.match(source, /world-leaders-chat-logo\.webp/);
  assert.match(source, /world-leaders-chat-favicon\.webp/);
  assert.match(source, /REAL EVENT • ORIGINAL SOURCES • IMAGINED REACTIONS/);
  assert.match(source, /SOURCE CREDIT:/);
  assert.match(source, /MORE MESSAGES IN THE FULL FILE/);
  assert.match(source, /eventUrl\(event\)/);
  assert.match(source, /https:\/\/worldleaders\.chat\/#event=/);
  assert.doesNotMatch(source, /Branded background, headline, chat excerpt, source credit and full-file link/);
});

test("Pages build ships the exporter after existing copy tools", async () => {
  const build = await read("scripts/build-site.mjs");
  const copyIndex = build.indexOf("social-tools.js");
  const pngIndex = build.indexOf("social-card-export.js");
  assert.ok(copyIndex >= 0 && pngIndex > copyIndex);
  assert.match(build, /social-card-export\.js\?v=20260810-carousel/);
  assert.match(build, /cp\(resolve\(root, "social-card-export\.js"\)/);
  assert.match(build, /social PNG exporter/);
});
