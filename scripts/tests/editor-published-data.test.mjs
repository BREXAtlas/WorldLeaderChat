import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("editor Published lane loads canonical site data instead of stale closed issue bodies", async () => {
  const adapter = await read("editor/published-data.js");
  const editor = await read("editor/index.html");
  const build = await read("scripts/build-site.mjs");
  assert.match(adapter, /published-events\.json/);
  assert.match(adapter, /publishedEvents\.map\(issueFromPublishedEvent\)/);
  assert.match(adapter, /labels: \[\{ name: "news-candidate" \}, \{ name: "published" \}\]/);
  assert.match(editor, /connect-src 'self' https:\/\/api\.github\.com/);
  assert.match(adapter, /state=closed&labels=rejected/);
  assert.match(adapter, /\.\.\.rejected\.filter/);
  assert.match(editor, /published-data\.js\?v=trash-rejections-20260811/);
  assert.match(build, /editor\/published-data\.js/);
});
