import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("public site ships full-chat and social-copy controls", async () => {
  const social = await read("social-tools.js");
  assert.match(social, /Copy Full Chat/);
  assert.match(social, /Copy Social Version/);
  assert.match(social, /FICTIONAL SATIRE/);
  assert.match(social, /PUBLIC RECORD/);
});

test("editor upgrades generated conversations to longer back-and-forth drafts", async () => {
  const upgrade = await read("editor/conversation-upgrade.js");
  assert.match(upgrade, /targetMessageCount: "10-14"/);
  assert.match(upgrade, /back-and-forth/);
  assert.match(upgrade, /result\.event\.messages = \[\.\.\.result\.event\.messages, \.\.\.additions\]/);
});

test("Pages build includes both social and conversation assets", async () => {
  const build = await read("scripts/build-site.mjs");
  assert.match(build, /social-tools\.js/);
  assert.match(build, /conversation-upgrade\.js/);
});
