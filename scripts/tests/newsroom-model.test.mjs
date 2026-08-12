import test from "node:test";
import assert from "node:assert/strict";
import { articleDraftSchema, extractNewsroomJson, runNewsroomJson } from "../lib/newsroom-model.mjs";

test("local newsroom JSON extraction tolerates a fenced or prefixed response", () => {
  assert.deepEqual(extractNewsroomJson('```json\n{"ready":true}\n```'), { ready: true });
  assert.deepEqual(extractNewsroomJson('Response:\n{"ready":true}\nDone.'), { ready: true });
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
