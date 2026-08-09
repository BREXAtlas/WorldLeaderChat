import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("public disclosure uses the approved concise footer and contains no repository copy", async () => {
  const disclosure = await read("disclosure-polish.js");
  assert.match(disclosure, /POLITICAL PARODY, NOT LEAKED CORRESPONDENCE/);
  assert.match(disclosure, /No private message on this page is authentic/);
  assert.doesNotMatch(disclosure, /GitHub|repository|deployment/i);
});

test("dialogue refinement keeps disclosure at site level and chat notes in-world", async () => {
  const refinement = await read("scripts/refine-editorial-dialogue.mjs");
  assert.match(refinement, /site-level disclosure; chat notes stay in-world/);
  assert.match(refinement, /The spreadsheet entered with notifications on/);
  assert.match(refinement, /Fifteen points entered; the conditions are already typing/);
});

test("Pages packages and verifies the final disclosure layer", async () => {
  const build = await read("scripts/build-site.mjs");
  const deploy = await read(".github/workflows/deploy-pages.yml");
  assert.match(build, /disclosure-polish\.js/);
  assert.match(deploy, /disclosure-polish\.js/);
  assert.match(deploy, /POLITICAL PARODY, NOT LEAKED CORRESPONDENCE/);
});
