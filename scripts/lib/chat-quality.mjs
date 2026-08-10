const META_NARRATION = /\b(imagined|hypothetical|would likely|would probably|plausible reaction|reaction consistent|response imagined|posture|style response|public-figure|a .*? response would|voice would)\b/i;
const THIRD_PERSON_OPENING = /^(frames|signals|calls for|counts|emphasizes|notes|observes|suggests|underlines|warns|describes|argues|states|says|sees|insists|urges|highlights|points to|maintains|reiterates|characterizes|portrays|indicates|acknowledges)\b/i;
const GENERIC_SPEAKER = /^(world leader|u\.?s\.? official|american official|european diplomat|government official|public figure|political observer|analyst|expert|commentator)$/i;
const STOCK_MEME = /\bdrake(?: meme)?\b|distracted boyfriend|two buttons|change my mind|expanding brain|this is fine dog|woman yelling at a cat/i;
const GENERIC_TITLE = /world leaders opened the news and immediately regretted having read receipts on/i;

const BANNED_RECYCLED_PHRASES = [
  "new thread opened. the first confident reply arrived before the briefing finished loading",
  "i have reviewed it and already have the strongest interpretation",
  "could we agree on the facts before competing over the dramatic interpretation",
  "the facts are doing very well under my interpretation",
  "that sentence made the meeting longer and the facts more nervous",
  "china is observing both the event and the speed with which everyone made it about themselves",
  "we may want to separate the development from the personality test",
  "the personality test had excellent ratings",
  "the agenda has again been defeated by the commentary on the agenda",
  "the typing indicator remains more stable than the consensus",
  "agenda restored. confidence in agenda: low",
  "i have thoughts. many people are saying they are excellent thoughts",
  "that sentence already made the meeting longer",
  "could we attempt one reply containing a complete policy",
  "china is observing the typing indicator",
  "i have brought a metaphorical chainsaw. again",
  "i would like the record to show my first message was still the strongest message",
  "the record has asked not to be involved",
  "can we discuss the actual event before someone changes the group name again",
  "fine. but the group name needs work",
  "china supports returning to the agenda. china also predicts this will not happen"
];

const STOPWORDS = new Set([
  "about", "after", "again", "against", "also", "among", "another", "around", "because", "before", "being", "between",
  "could", "from", "have", "into", "just", "more", "most", "over", "said", "says", "than", "that", "their", "them", "there",
  "these", "they", "this", "those", "through", "under", "until", "very", "what", "when", "where", "which", "while", "with",
  "would", "world", "leader", "leaders", "chat", "news", "article", "report", "reporting", "source", "sources", "current", "new",
  "first", "latest", "live", "update", "updates", "today", "yesterday", "tomorrow", "real", "private", "public", "event", "events",
  "plan", "file", "thread", "admin", "group", "message", "messages", "reply", "replies", "reaction", "reactions", "fictional", "satire"
]);

export function normalizeDialogueText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function meaningfulTokens(value) {
  const counts = new Map();
  for (const token of normalizeDialogueText(value).split(/\s+/)) {
    if (!token || token.length < 4 || STOPWORDS.has(token) || /^\d+$/.test(token)) continue;
    counts.set(token, (counts.get(token) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .map(([token]) => token);
}

function contextTokens(bundle) {
  const event = bundle?.event || {};
  const article = event.article || {};
  const sourceLabels = (event.sources || []).map((source) => source.label).join(" ");
  return meaningfulTokens(`${event.title || ""} ${article.headline || ""} ${article.dek || ""} ${event.summary || ""} ${sourceLabels}`).slice(0, 18);
}

function messageLines(messages) {
  return (messages || [])
    .filter((message) => message && message.kind !== "system")
    .map((message) => normalizeDialogueText(message.text))
    .filter(Boolean);
}

export function dialogueSignature(messages) {
  return messageLines(messages).sort().join("|");
}

export function dialogueSimilarity(leftMessages, rightMessages) {
  const left = new Set(messageLines(leftMessages));
  const right = new Set(messageLines(rightMessages));
  if (!left.size || !right.size) return { exactOverlap: 0, jaccard: 0 };
  let exactOverlap = 0;
  for (const line of left) if (right.has(line)) exactOverlap += 1;
  const union = new Set([...left, ...right]).size;
  return { exactOverlap, jaccard: union ? exactOverlap / union : 0 };
}

function contextOverlap(bundle, messages) {
  const tokens = contextTokens(bundle);
  if (!tokens.length) return { tokens, matched: [] };
  const corpus = normalizeDialogueText((messages || []).map((message) => `${message?.speaker || ""} ${message?.text || ""}`).join(" "));
  const matched = tokens.filter((token) => new RegExp(`\\b${token}\\b`, "i").test(corpus));
  return { tokens, matched };
}

export function dialogueProblems(bundle, options = {}) {
  const problems = [];
  const messages = bundle?.event?.messages;
  if (!Array.isArray(messages)) return ["Chat messages are missing."];
  if (messages.length < 10 || messages.length > 14) problems.push(`Chat must contain 10–14 messages; found ${messages.length}.`);

  const normalizedLines = new Set();
  const counts = new Map();
  let previousSpeaker = "";
  for (const [index, message] of messages.entries()) {
    const speaker = String(message?.speaker || "").trim();
    const text = String(message?.text || "").trim();
    const normalized = normalizeDialogueText(text);
    const label = `Message ${index + 1}`;

    if (!speaker || !text) problems.push(`${label} is missing a speaker or text.`);
    if (GENERIC_SPEAKER.test(speaker)) problems.push(`${label} uses a generic speaker (${speaker}).`);
    if (message?.kind !== "system") {
      counts.set(speaker, (counts.get(speaker) || 0) + 1);
      if (previousSpeaker && speaker === previousSpeaker) problems.push(`${label} repeats ${speaker} in consecutive turns.`);
      previousSpeaker = speaker;
    }
    if (META_NARRATION.test(text) || THIRD_PERSON_OPENING.test(text)) problems.push(`${label} describes a reaction instead of speaking in the person’s voice.`);
    if (BANNED_RECYCLED_PHRASES.some((phrase) => normalized.includes(phrase))) problems.push(`${label} contains a recycled stock line.`);
    if (normalized && normalizedLines.has(normalized)) problems.push(`${label} duplicates another line in the same chat.`);
    normalizedLines.add(normalized);
  }

  const recurring = [...counts.values()].filter((count) => count >= 2).length;
  if (recurring < 2) problems.push("At least two speakers must return to the conversation.");

  const overlap = contextOverlap(bundle, messages);
  const requiredOverlap = overlap.tokens.length >= 6 ? 3 : overlap.tokens.length >= 3 ? 2 : 1;
  if (overlap.tokens.length && overlap.matched.length < requiredOverlap) {
    problems.push(`Chat does not stay tied to the article; matched ${overlap.matched.length} of the key event terms (${overlap.tokens.slice(0, 8).join(", ")}).`);
  }

  if (GENERIC_TITLE.test(String(bundle?.event?.title || ""))) problems.push("Headline is the recycled generic World Leaders Opened the News title.");
  if (STOCK_MEME.test(String(bundle?.event?.meme || ""))) problems.push("Closing line uses a stock named meme instead of an original event-specific punch line.");

  for (const other of options.existingBundles || []) {
    if (!other?.event || other.event.id === bundle?.event?.id) continue;
    const similarity = dialogueSimilarity(messages, other.event.messages);
    if (similarity.exactOverlap >= 2 || similarity.jaccard >= 0.35) {
      problems.push(`Chat reuses too much dialogue from ${other.event.title || other.event.id}.`);
      break;
    }
  }

  return [...new Set(problems)];
}

export function dialogueReady(bundle, options = {}) {
  return dialogueProblems(bundle, options).length === 0;
}

export function stockMemeDetected(value) {
  return STOCK_MEME.test(String(value || ""));
}

export function recycledPhraseDetected(value) {
  const normalized = normalizeDialogueText(value);
  return BANNED_RECYCLED_PHRASES.some((phrase) => normalized.includes(phrase));
}
