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

const messageSchema = {
  type: "object",
  properties: {
    speaker: { type: "string", minLength: 2, maxLength: 100 },
    text: { type: "string", minLength: 30, maxLength: 300 },
    kind: { type: "string", enum: ["satire", "system"] },
    reaction: { type: "string" }
  },
  required: ["speaker", "text", "kind", "reaction"],
  additionalProperties: false
};

const generatedMessageSchema = {
  type: "object",
  properties: {
    speakerKey: { type: "string", enum: ["a", "b", "c"] },
    text: { type: "string", minLength: 30, maxLength: 300 }
  },
  required: ["speakerKey", "text"],
  additionalProperties: false
};

export const chatDraftSchema = {
  type: "object",
  properties: {
    participants: {
      type: "object",
      properties: {
        a: { type: "string", minLength: 2, maxLength: 100 },
        b: { type: "string", minLength: 2, maxLength: 100 },
        c: { type: "string", minLength: 2, maxLength: 100 }
      },
      required: ["a", "b", "c"],
      additionalProperties: false
    },
    messages: { type: "array", minItems: 12, maxItems: 14, items: generatedMessageSchema },
    closingLine: { type: "string", minLength: 10, maxLength: 220 },
    reviewNotes: { type: "string", minLength: 10, maxLength: 600 }
  },
  required: ["participants", "messages", "closingLine", "reviewNotes"],
  additionalProperties: false
};

export const chatPlanSchema = {
  type: "object",
  properties: {
    speakers: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: { type: "string", minLength: 2, maxLength: 100 }
    },
    turns: {
      type: "array",
      minItems: 12,
      maxItems: 12,
      items: { type: "string", minLength: 30, maxLength: 180 }
    },
    closingLine: { type: "string", minLength: 20, maxLength: 220 },
    reviewNotes: { type: "string", minLength: 20, maxLength: 400 }
  },
  required: ["speakers", "turns", "closingLine", "reviewNotes"],
  additionalProperties: false
};

export const draftAuditSchema = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["pass", "fail"] },
    unsupportedArticleClaims: {
      type: "array",
      maxItems: 8,
      items: { type: "string", minLength: 5, maxLength: 260 }
    },
    unsupportedChatClaims: {
      type: "array",
      maxItems: 8,
      items: { type: "string", minLength: 5, maxLength: 260 }
    },
    genericOrPlaceholderCopy: {
      type: "array",
      maxItems: 8,
      items: { type: "string", minLength: 5, maxLength: 260 }
    },
    reason: { type: "string", minLength: 10, maxLength: 500 }
  },
  required: ["verdict", "unsupportedArticleClaims", "unsupportedChatClaims", "genericOrPlaceholderCopy", "reason"],
  additionalProperties: false
};

export const articleDraftSchema = {
  type: "object",
  properties: {
    title: { type: "string", minLength: 10, maxLength: 240 },
    kicker: { type: "string", minLength: 10, maxLength: 320 },
    category: { type: "string", minLength: 2, maxLength: 80 },
    article: {
      type: "object",
      properties: {
        headline: { type: "string", minLength: 20, maxLength: 240 },
        dek: { type: "string", minLength: 40, maxLength: 420 },
        body: { type: "array", minItems: 3, maxItems: 5, items: { type: "string", minLength: 220, maxLength: 1200 } },
        sourceCredit: { type: "string" }
      },
      required: ["headline", "dek", "body", "sourceCredit"],
      additionalProperties: false
    },
    messages: { type: "array", minItems: 10, maxItems: 14, items: messageSchema },
    meme: { type: "string", minLength: 10, maxLength: 220 },
    tone: { type: "string", enum: ["comic", "sober"] },
    reviewNotes: { type: "string", minLength: 10, maxLength: 600 }
  },
  required: ["title", "kicker", "category", "article", "messages", "meme", "tone", "reviewNotes"],
  additionalProperties: false
};

export const articleOnlySchema = {
  type: "object",
  properties: {
    title: articleDraftSchema.properties.title,
    kicker: articleDraftSchema.properties.kicker,
    category: articleDraftSchema.properties.category,
    article: {
      ...articleDraftSchema.properties.article,
      properties: {
        ...articleDraftSchema.properties.article.properties,
        body: {
          type: "array",
          minItems: 3,
          maxItems: 3,
          items: { type: "string", minLength: 220, maxLength: 700 }
        }
      }
    },
    reviewNotes: articleDraftSchema.properties.reviewNotes
  },
  required: ["title", "kicker", "category", "article", "reviewNotes"],
  additionalProperties: false
};

const INVALID_PLANNED_SPEAKER = /^(?:un\s+)?admin$|^(?:world leader|u\.?s\.? official|american official|european diplomat|government official|public figure|political observer|analyst|expert|commentator)$/i;
const PLACEHOLDER_SPEAKER = /^(?:alice|bob|charlie|david|frank|grace|hannah|julia|speaker\s*[abc])$/i;

export function materializeChatDraft(draft) {
  const participants = draft?.participants || {};
  const names = [participants.a, participants.b, participants.c].map((name) => String(name || "").trim());
  const unique = new Set(names.map((name) => name.toLowerCase()));
  if (names.some((name) => !name) || unique.size !== 3 || names.some((name) => INVALID_PLANNED_SPEAKER.test(name) || PLACEHOLDER_SPEAKER.test(name))) {
    throw new Error("Generated chat must name exactly three distinct, specific event participants; no admin, narrator, placeholder person or generic role.");
  }
  if (!Array.isArray(draft?.messages) || draft.messages.length < 12 || draft.messages.length > 14) {
    throw new Error(`Generated chat must contain 12–14 keyed messages; found ${draft?.messages?.length || 0}.`);
  }
  const participantByKey = { a: names[0], b: names[1], c: names[2] };
  const messages = draft.messages.map((message, index) => {
    const speaker = participantByKey[message?.speakerKey];
    if (!speaker) throw new Error(`Generated message ${index + 1} has an invalid participant key.`);
    const escapedSpeaker = speaker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const text = String(message?.text || "").trim()
      .replace(/^[abc]\s*:\s*/i, "")
      .replace(new RegExp(`^${escapedSpeaker}\\s*:\\s*`, "i"), "");
    return { speaker, text, kind: "satire", reaction: "" };
  });
  return { ...draft, messages };
}

export function messagesFromChatPlan(plan) {
  const speakers = Array.isArray(plan?.speakers)
    ? plan.speakers.map((speaker) => String(speaker || "").trim()).filter(Boolean)
    : [];
  const unique = new Set(speakers.map((speaker) => speaker.toLowerCase()));
  if (speakers.length !== 3 || unique.size !== 3 || speakers.some((speaker) => INVALID_PLANNED_SPEAKER.test(speaker))) {
    throw new Error("Chat plan must name exactly three distinct, specific event participants; no admin, narrator or generic role.");
  }
  if (!Array.isArray(plan?.turns) || plan.turns.length !== 12) {
    throw new Error("Chat plan must contain exactly twelve original turns.");
  }
  for (const [index, rawTurn] of plan.turns.entries()) {
    const turn = String(rawTurn || "").trim();
    const words = turn.split(/\s+/).filter(Boolean).length;
    if (words < 6 || words > 28) throw new Error(`Chat turn ${index + 1} must contain 6–28 words; found ${words}.`);
    if (words >= 25 && !/[.!?…][\"')\]]?$/.test(turn)) throw new Error(`Chat turn ${index + 1} appears cut off.`);
    if (speakers.some((speaker) => turn.toLowerCase().startsWith(`${speaker.toLowerCase()}:`))) {
      throw new Error(`Chat turn ${index + 1} repeats its speaker label inside the message.`);
    }
  }
  return plan.turns.map((turn, index) => ({
    speaker: speakers[index % speakers.length],
    text: /[.!?…][\"')\]]?$/.test(String(turn || "").trim()) ? String(turn || "").trim() : `${String(turn || "").trim()}.`,
    kind: "satire",
    reaction: ""
  }));
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
      temperature: Number(options.temperature ?? process.env.WLC_WRITER_TEMPERATURE ?? 0.55),
      top_p: 0.9,
      max_tokens: Number(options.maxTokens || process.env.WLC_WRITER_MAX_TOKENS || 1400),
      stream: false,
      response_format: options.schema
        ? { type: "json_object", schema: options.schema }
        : { type: "json_object" }
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
