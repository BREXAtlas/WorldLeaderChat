const RELATED_WINDOW_DAYS = 21;
const STOP_WORDS = new Set([
  "about", "after", "again", "against", "along", "among", "because", "before", "being", "below", "between",
  "could", "first", "from", "have", "into", "latest", "more", "most", "news", "other", "over", "report", "reports",
  "said", "says", "same", "some", "than", "that", "their", "them", "then", "there", "these", "they", "this", "those",
  "through", "under", "very", "what", "when", "where", "which", "while", "will", "with", "would", "world"
]);

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9.]+/g, " ")
    .trim();
}

function eventText(event) {
  return `${event?.title || ""} ${event?.kicker || ""} ${event?.article?.headline || ""} ${event?.article?.dek || ""}`;
}

function eventTime(event) {
  const machine = String(event?.eventDate || "").match(/^\d{4}-\d{2}-\d{2}$/);
  if (machine) return Date.parse(`${event.eventDate}T12:00:00Z`) || 0;
  const parsed = Date.parse(String(event?.date || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function explicitGroup(event) {
  return normalize(event?.eventGroup || event?.relatedGroup || event?.editorial?.eventGroup || event?.editorial?.relatedGroup);
}

function eventTokens(event) {
  return new Set(normalize(eventText(event)).split(/\s+/).filter((token) => token.length > 3 && !STOP_WORDS.has(token)));
}

function numericAnchors(event) {
  return new Set(normalize(eventText(event)).match(/\b\d+(?:\.\d+)?\b/g) || []);
}

function participantKeys(event) {
  return new Set((event?.messages || [])
    .filter((message) => message?.kind !== "system" && !/admin/i.test(String(message?.speaker || "")))
    .map((message) => normalize(message.speaker).split(/\s+/).filter(Boolean).at(-1))
    .filter((key) => key && key.length >= 4));
}

function sharedCount(left, right) {
  return [...left].filter((value) => right.has(value)).length;
}

function sharedSourceUrl(a, b) {
  const urls = new Set((a?.sources || []).map((source) => String(source.url || "").split(/[?#]/)[0]).filter(Boolean));
  return (b?.sources || []).some((source) => urls.has(String(source.url || "").split(/[?#]/)[0]));
}

export function sameUnderlyingEvent(a, b) {
  if (!a || !b || a.id === b.id) return Boolean(a && b && a.id === b.id);
  const aGroup = explicitGroup(a);
  const bGroup = explicitGroup(b);
  if (aGroup && bGroup) return aGroup === bGroup;
  if (sharedSourceUrl(a, b)) return true;
  const age = Math.abs(eventTime(a) - eventTime(b)) / 86400000;
  if (!Number.isFinite(age) || age > RELATED_WINDOW_DAYS) return false;

  const aTokens = eventTokens(a);
  const bTokens = eventTokens(b);
  const sharedTokens = sharedCount(aTokens, bTokens);
  const union = new Set([...aTokens, ...bTokens]);
  const similarity = union.size ? sharedTokens / union.size : 0;
  if (sharedTokens >= 6 || (sharedTokens >= 4 && similarity >= 0.2) || (sharedTokens >= 3 && similarity >= 0.32)) return true;

  const sharedParticipants = sharedCount(participantKeys(a), participantKeys(b));
  const sharedNumbers = sharedCount(numericAnchors(a), numericAnchors(b));
  return sharedParticipants >= 3 && sharedTokens >= 1 && sharedNumbers >= 1;
}

export function assignRelatedEventGroup(incoming, published) {
  const direct = (published || []).filter((event) => sameUnderlyingEvent(incoming, event));
  if (!direct.length) return { eventGroup: "", related: [] };

  const existingGroups = new Set(direct.map(explicitGroup).filter(Boolean));
  const related = existingGroups.size
    ? (published || []).filter((event) => direct.includes(event) || existingGroups.has(explicitGroup(event)))
    : direct;
  const eventGroup = [...existingGroups].sort()[0]
    || `event-${[incoming, ...related].map((event) => String(event.id || "")).filter(Boolean).sort()[0]}`;

  for (const event of related) event.eventGroup = eventGroup;
  incoming.eventGroup = eventGroup;
  return { eventGroup, related };
}
