import test from "node:test";
import assert from "node:assert/strict";
import { buildDirectDialogue, dialogueNeedsRefinement } from "../lib/newsroom-dialogue.mjs";

function bundle(title, summary, messages = []) {
  return {
    event: {
      title,
      summary,
      sources: [{ label: title, publisher: "Test News", url: "https://example.com/story" }],
      messages
    }
  };
}

function recurringSpeakerCount(messages) {
  const counts = new Map();
  for (const message of messages) {
    if (message.kind === "system") continue;
    counts.set(message.speaker, (counts.get(message.speaker) || 0) + 1);
  }
  return [...counts.values()].filter((count) => count >= 2).length;
}

test("descriptive meta-narration is rejected even when a draft has enough messages", () => {
  const messages = Array.from({ length: 10 }, (_, index) => ({
    speaker: index % 2 ? "Leader One" : "Leader Two",
    text: index === 3
      ? "A pragmatic leader's imagined take would likely stress stability."
      : `Direct line ${index}`,
    kind: "satire",
    reaction: ""
  }));
  assert.equal(dialogueNeedsRefinement(bundle("Election poll", "A real poll was released.", messages)), true);
});

test("one-off speaker parade is rejected because it is not a conversation", () => {
  const messages = Array.from({ length: 10 }, (_, index) => ({
    speaker: `Speaker ${index}`,
    text: `Direct line ${index}`,
    kind: "satire",
    reaction: ""
  }));
  assert.equal(dialogueNeedsRefinement(bundle("World news", "A real event occurred.", messages)), true);
});

test("Israeli election dialogue uses direct speech and recurring speakers", () => {
  const messages = buildDirectDialogue(bundle(
    "Concerns mount over integrity of Israel's upcoming October elections",
    "A poll reported concern about election integrity among Jewish Israelis."
  ));
  assert.ok(messages.length >= 10 && messages.length <= 14);
  assert.ok(recurringSpeakerCount(messages) >= 2);
  assert.ok(messages.some((message) => message.speaker === "Netanyahu"));
  assert.ok(messages.some((message) => message.speaker === "Yair Lapid"));
  assert.ok(messages.every((message) => !/imagined|hypothetical|would likely|posture/i.test(message.text)));
  assert.equal(dialogueNeedsRefinement(bundle("Election integrity", "Israel election poll", messages)), false);
});

test("culture and space conversations can include adjacent public figures", () => {
  const taylor = buildDirectDialogue(bundle(
    "Taylor Swift songs removed from Trump TikTok post",
    "A copyright dispute led to the songs being removed."
  ));
  assert.ok(taylor.some((message) => message.speaker === "Taylor Swift"));
  assert.ok(taylor.some((message) => message.speaker === "White House Comms"));

  const space = buildDirectDialogue(bundle(
    "SpaceX launches a new rocket mission",
    "The launch was completed and national space agencies tracked the flight."
  ));
  assert.ok(space.some((message) => message.speaker === "Elon Musk"));
  assert.ok(space.some((message) => message.speaker === "Jeff Bezos"));
  assert.ok(recurringSpeakerCount(space) >= 2);
});
