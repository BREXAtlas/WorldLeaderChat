import test from "node:test";
import assert from "node:assert/strict";
import { articleDraftSchema, chatDraftSchema, chatPlanSchema, extractNewsroomJson, firstPersonizeSpeakerText, materializeChatDraft, messagesFromChatPlan, runNewsroomJson } from "../lib/newsroom-model.mjs";

test("local newsroom JSON extraction tolerates a fenced or prefixed response", () => {
  assert.deepEqual(extractNewsroomJson('```json\n{"ready":true}\n```'), { ready: true });
  assert.deepEqual(extractNewsroomJson('Response:\n{"ready":true}\nDone.'), { ready: true });
});

test("chat plans enforce three recurring event participants across twelve turns", () => {
  assert.ok(chatPlanSchema.properties.closingLine);
  assert.equal(chatPlanSchema.properties.meme, undefined);
  assert.ok(chatPlanSchema.required.includes("closingLine"));
  const messages = messagesFromChatPlan({
    speakers: ["Wendy's", "Trian Fund", "Nelson Peltz"],
    turns: Array.from({ length: 12 }, (_, index) => `This event-specific direct reply number ${index + 1} contains enough concrete detail.`)
  });
  assert.equal(messages.length, 12);
  assert.deepEqual(messages.slice(0, 6).map((message) => message.speaker), [
    "Wendy's", "Trian Fund", "Nelson Peltz", "Wendy's", "Trian Fund", "Nelson Peltz"
  ]);
  assert.ok(messages.every((message) => message.kind === "satire"));
  assert.throws(() => messagesFromChatPlan({
    speakers: ["UN Admin", "Analyst", "World Leader"],
    turns: Array(12).fill("This invalid turn is long enough for the schema but not the participant gate.")
  }), /specific event participants/);
});

test("direct chat drafts request a closing line without exposing the legacy meme field to the writer", () => {
  assert.ok(chatDraftSchema.properties.participants);
  assert.deepEqual(chatDraftSchema.properties.messages.items.properties.speakerKey.enum, ["a", "b", "c"]);
  assert.equal(chatDraftSchema.properties.messages.minItems, 12);
  assert.ok(chatDraftSchema.properties.closingLine);
  assert.equal(chatDraftSchema.properties.meme, undefined);
  assert.ok(chatDraftSchema.required.includes("closingLine"));
  assert.ok(!chatDraftSchema.required.includes("meme"));
});

test("direct chat drafts materialize three recurring event participants into the approved reader format", () => {
  const sequence = ["a", "b", "a", "c", "b", "a", "c", "b", "c", "a", "b", "c"];
  const draft = materializeChatDraft({
    participants: { a: "Trump Administration", b: "Cybersecurity Firms", c: "Congress" },
    messages: sequence.map((speakerKey, index) => ({ speakerKey, text: `${speakerKey}: This event-specific response number ${index + 1} contains a complete direct position.` })),
    closingLine: "The authorization arrived before the accountability plan finished loading.",
    reviewNotes: "Every speaker is tied to the reported cyberattack policy."
  });
  assert.deepEqual(draft.messages.slice(0, 3).map((message) => message.speaker), ["Trump Administration", "Cybersecurity Firms", "Trump Administration"]);
  assert.ok(draft.messages.every((message) => message.kind === "satire" && message.reaction === ""));
  assert.ok(draft.messages.every((message) => !/^[abc]:/i.test(message.text)));
  assert.throws(() => materializeChatDraft({
    participants: { a: "Charlie", b: "David", c: "Frank" },
    messages: sequence.map((speakerKey) => ({ speakerKey, text: "This placeholder exchange contains enough words but has invented speakers." }))
  }), /specific event participants/);
});

test("exact speaker-name self references are normalized into grammatical first person", () => {
  assert.equal(
    firstPersonizeSpeakerText("Bills Mafia", "Bills Mafia deserves clear sightlines because the Bills Mafia has paid for these seats."),
    "We deserve clear sightlines because we have paid for these seats."
  );
  assert.equal(
    firstPersonizeSpeakerText("Nelson Peltz", "Nelson Peltz wants the board to explain its decision to Nelson Peltz."),
    "I want the board to explain its decision to me."
  );
});

test("chat plans reject speaker prefixes and visibly cut-off turns", () => {
  assert.throws(() => messagesFromChatPlan({
    speakers: ["Apple", "iPhone Team", "Retailers"],
    turns: ["Apple: This launch calendar is now the whole argument.", ...Array(11).fill("This event-specific reply has enough words and closes cleanly.")]
  }), /speaker label/);
  assert.throws(() => messagesFromChatPlan({
    speakers: ["Apple", "iPhone Team", "Retailers"],
    turns: ["This deliberately overlong generated sentence keeps adding filler until it reaches the schema boundary and then stops without a conclusion or any closing punctuation at all", ...Array(11).fill("This event-specific reply has enough words and closes cleanly.")]
  }), /appears cut off/);
});

test("newsroom writing calls only the configured local endpoint", async () => {
  let received;
  const output = await runNewsroomJson("Return JSON", {
    endpoint: "http://local-writer.test/v1/chat/completions",
    schema: articleDraftSchema,
    fetch: async (url, options) => {
      received = { url, options };
      return new Response(JSON.stringify({
        choices: [{ message: { content: '{"ready":true}' } }]
      }));
    }
  });
  assert.deepEqual(output, { ready: true });
  assert.equal(received.url, "http://local-writer.test/v1/chat/completions");
  const request = JSON.parse(received.options.body);
  assert.equal(request.stream, false);
  assert.equal(request.response_format.schema.properties.messages.minItems, 10);
  assert.equal(request.response_format.schema.properties.messages.maxItems, 14);
  assert.equal(request.response_format.schema.properties.article.properties.body.minItems, 3);
  assert.equal(request.response_format.schema.properties.kicker.minLength, 10);
  assert.equal(request.response_format.schema.properties.kicker.maxLength, 320);
});
