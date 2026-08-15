import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url));
const text = async (path) => (await read(path)).toString("utf8");

test("Pages build installs the selected World Leader Chat masthead logo", async () => {
  const build = await text("scripts/build-site.mjs");
  const logo = await read("assets/world-leaders-chat-logo.webp");
  assert.ok(logo.byteLength > 10000);
  assert.match(build, /world-leaders-chat-logo\.webp/);
  assert.match(build, /class=\"brand-logo\"/);
  assert.match(build, /News\. Analysis\. Imagination\./);
  assert.match(build, /NEWS\. ANALYSIS\. IMAGINATION\./);
  assert.doesNotMatch(build, /NEWS\. ANALYSIS\. SATIRE\./);
  assert.match(build, /onerror=\"this\.hidden=true;this\.nextElementSibling\.hidden=false\"/);
  assert.match(build, /class=\"brand-fallback\"/);
  assert.match(build, /WORLD LEADERS/);
  assert.match(build, /\.brand-logo\[hidden\],\.brand-fallback\[hidden\]\{display:none\}/);
});

test("Pages build installs the selected second-logo mark as favicon", async () => {
  const build = await text("scripts/build-site.mjs");
  const favicon = await read("assets/world-leaders-chat-favicon.webp");
  assert.ok(favicon.byteLength > 1000);
  assert.match(build, /rel=\"icon\" type=\"image\/webp\" href=\"\.\/assets\/world-leaders-chat-favicon\.webp\"/);
  assert.match(build, /cp\(resolve\(root, \"assets\/world-leaders-chat-favicon\.webp\"/);
});
