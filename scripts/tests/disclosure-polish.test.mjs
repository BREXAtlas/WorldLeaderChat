import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("public footer uses the requested publication contact and contains no repository copy", async () => {
  const html = await read("index.html");
  const disclosure = await read("disclosure-polish.js");
  assert.match(html, /mailto:hello@transformontologysystems\.com/);
  assert.match(html, /Powered by TOS/);
  assert.match(html, /© 2026 World Leaders Chat/);
  assert.doesNotMatch(html, /Branded background, headline, chat excerpt/);
  assert.doesNotMatch(disclosure, /document\.querySelector\("footer"\)/);
  assert.doesNotMatch(disclosure, /GitHub|repository|deployment/i);
});

test("dialogue refinement keeps disclosure at site level and chat notes in-world", async () => {
  const refinement = await read("scripts/refine-editorial-dialogue.mjs");
  assert.match(refinement, /site-level disclosure; chat notes stay in-world/);
  assert.match(refinement, /New thread: election confidence/);
  assert.match(refinement, /New thread: Gaza roadmap/);
  assert.doesNotMatch(refinement, /Fifteen points entered; the conditions are already typing/);
});

test("Pages packages the disclosure layer and verifies the custom-domain footer", async () => {
  const build = await read("scripts/build-site.mjs");
  const deploy = await read(".github/workflows/deploy-pages.yml");
  assert.match(build, /disclosure-polish\.js/);
  assert.match(deploy, /disclosure-polish\.js/);
  assert.match(deploy, /PUBLIC_URL: https:\/\/worldleaders\.chat\//);
  assert.match(deploy, /hello@transformontologysystems\.com/);
  assert.match(deploy, /Powered by TOS/);
});
