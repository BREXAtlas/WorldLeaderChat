import test from "node:test";
import assert from "node:assert/strict";
import { articleDraftSchema, extractNewsroomJson, messagesFromChatPlan, runNewsroomJson } from "../lib/newsroom-model.mjs";

test("local newsroom JSON extraction tolerates a fenced or prefixed response", () => {
  assert.deepEqual(extractNewsroomJson('```json\n{"ready":true}\n```'), { ready: true });
  assert.deepEqual(extractNewsroomJson('Response:\n{"ready":true}\nDone.'), { ready: true });
});

test("chat plans enforce three recurring event participants across twelve turns", () => {
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
});
