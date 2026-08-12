import test from "node:test";
import assert from "node:assert/strict";
import { extractNewsroomJson, runNewsroomJson } from "../lib/newsroom-model.mjs";

test("local newsroom JSON extraction tolerates a fenced or prefixed response", () => {
  assert.deepEqual(extractNewsroomJson('```json\n{"ready":true}\n```'), { ready: true });
  assert.deepEqual(extractNewsroomJson('Response:\n{"ready":true}\nDone.'), { ready: true });
});

test("newsroom writing calls only the configured local endpoint", async () => {
  let received;
  const output = await runNewsroomJson("Return JSON", {
    endpoint: "http://local-writer.test/v1/chat/completions",
    fetch: async (url, options) => {
      received = { url, options };
      return new Response(JSON.stringify({
        choices: [{ message: { content: '{"ready":true}' } }]
      }));
    }
  });
  assert.deepEqual(output, { ready: true });
  assert.equal(received.url, "http://local-writer.test/v1/chat/completions");
  assert.equal(JSON.parse(received.options.body).stream, false);
});
