function stripDecoration(value) {
  return String(value || "")
    .replace(/\u001b\[[0-9;]*m/g, "")
    .trim();
}

function balancedJsonObjects(value) {
  const objects = [];
  let start = -1;
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') quoted = false;
      continue;
    }
    if (character === '"') {
      quoted = true;
      continue;
    }
    if (character === "{") {
      if (depth === 0) start = index;
      depth += 1;
    } else if (character === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        objects.push(value.slice(start, index + 1));
        start = -1;
      }
    }
  }
  return objects;
}

export function extractNewsroomJson(value) {
  const cleaned = stripDecoration(value)
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  try { return JSON.parse(cleaned); } catch {}
  for (const candidate of balancedJsonObjects(cleaned)) {
    try { return JSON.parse(candidate); } catch {}
  }
  throw new Error("Local newsroom writer did not return one complete JSON object.");
}

function diagnostic(value) {
  return stripDecoration(value).replace(/\s+/g, " ").slice(0, 1000);
}

export async function runNewsroomJson(prompt, options = {}) {
  const endpoint = options.endpoint || process.env.WLC_WRITER_ENDPOINT || "http://127.0.0.1:8080/v1/chat/completions";
  const request = options.fetch || globalThis.fetch;
  if (typeof request !== "function") throw new Error("The local newsroom writer requires fetch.");

  const response = await request(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.WLC_WRITER_MODEL || "local-newsroom-writer",
      messages: [
        {
          role: "system",
          content: "You are a meticulous independent newsroom writer. Obey the source lock, make every conversation original to its event, and return exactly one valid JSON object."
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.78,
      top_p: 0.9,
      max_tokens: Number(options.maxTokens || process.env.WLC_WRITER_MAX_TOKENS || 1400),
      stream: false,
      response_format: { type: "json_object" }
    })
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Local newsroom writer ${response.status}: ${diagnostic(text)}`);
  let payload;
  try { payload = JSON.parse(text); } catch {
    throw new Error(`Local newsroom writer returned an invalid API response: ${diagnostic(text)}`);
  }
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Local newsroom writer returned no article content.");
  return extractNewsroomJson(content);
}
