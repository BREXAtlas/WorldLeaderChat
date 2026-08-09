function add(errors, condition, message) {
  if (!condition) errors.push(message);
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringLengthBetween(value, min, max) {
  return typeof value === "string" && value.trim().length >= min && value.trim().length <= max;
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""))) return false;
  const [year, month, day] = String(value).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function isSha256(value) {
  return /^[a-f0-9]{64}$/.test(String(value ?? ""));
}

function containsPlaceholder(value, policy) {
  const haystack = JSON.stringify(value).toUpperCase();
  return (policy.placeholderPatterns ?? []).some((pattern) => haystack.includes(String(pattern).toUpperCase()));
}

export function validateEvent(event, policy, options = {}) {
  const errors = [];
  const context = options.context ? `${options.context}: ` : "";
  const maxSummary = Number(policy.maximumSummaryCharacters ?? 1200);
  const maxMeme = Number(policy.maximumMemeCharacters ?? 220);
  const maxPublic = Number(policy.maximumPublicExcerptCharacters ?? 280);
  const minMessages = Number(policy.minimumChatMessages ?? 5);
  const maxMessages = Number(policy.maximumChatMessages ?? 30);
  const minSatire = Number(policy.minimumSatireMessages ?? 3);

  add(errors, isObject(event), `${context}event must be an object.`);
  if (!isObject(event)) return errors;

  add(errors, /^[a-z0-9][a-z0-9-]{5,100}$/.test(event.id ?? ""), `${context}event.id must be a stable lowercase slug.`);
  add(errors, isCalendarDate(event.eventDate), `${context}event.eventDate must be a valid YYYY-MM-DD calendar date.`);
  add(errors, Number.isInteger(event.year) && event.year >= 2020 && event.year <= 2100, `${context}event.year must be an integer from 2020–2100.`);
  if (isCalendarDate(event.eventDate) && Number.isInteger(event.year)) {
    add(errors, Number(event.eventDate.slice(0, 4)) === event.year, `${context}event.year must match event.eventDate.`);
  }
  add(errors, stringLengthBetween(event.date, 6, 80), `${context}event.date must be a readable display date.`);
  add(errors, stringLengthBetween(event.title, 10, 240), `${context}event.title must be 10–240 characters.`);
  add(errors, stringLengthBetween(event.kicker, 10, 320), `${context}event.kicker must be 10–320 characters.`);
  add(errors, stringLengthBetween(event.category, 2, 80), `${context}event.category must be 2–80 characters.`);
  add(errors, stringLengthBetween(event.summary, 50, maxSummary), `${context}event.summary must be 50–${maxSummary} characters.`);
  add(errors, stringLengthBetween(event.meme, 10, maxMeme), `${context}event.meme must be 10–${maxMeme} characters.`);
  add(errors, (policy.allowedTones ?? ["comic", "sober"]).includes(event.tone), `${context}event.tone is not allowed.`);
  add(errors, !containsPlaceholder(event, policy), `${context}event still contains an editorial placeholder.`);

  add(errors, Array.isArray(event.sources) && event.sources.length >= 1, `${context}event.sources must contain at least one source.`);
  const sourceUrls = new Set();
  if (Array.isArray(event.sources)) {
    event.sources.forEach((source, index) => {
      add(errors, isObject(source), `${context}source ${index + 1} must be an object.`);
      if (!isObject(source)) return;
      add(errors, stringLengthBetween(source.label, 3, 300), `${context}source ${index + 1} needs a label.`);
      add(errors, stringLengthBetween(source.publisher, 2, 120), `${context}source ${index + 1} needs a publisher.`);
      add(errors, isHttpsUrl(source.url), `${context}source ${index + 1} must use an HTTPS URL.`);
      if (source.url) {
        add(errors, !sourceUrls.has(source.url), `${context}source ${index + 1} duplicates another source URL.`);
        sourceUrls.add(source.url);
      }
    });
  }

  add(errors, Array.isArray(event.messages), `${context}event.messages must be an array.`);
  if (Array.isArray(event.messages)) {
    add(errors, event.messages.length >= minMessages && event.messages.length <= maxMessages,
      `${context}event.messages must contain ${minMessages}–${maxMessages} messages.`);
    const satireCount = event.messages.filter((message) => message?.kind === "satire").length;
    add(errors, satireCount >= minSatire, `${context}event.messages must include at least ${minSatire} fictional satire messages.`);

    event.messages.forEach((message, index) => {
      const label = `${context}message ${index + 1}`;
      add(errors, isObject(message), `${label} must be an object.`);
      if (!isObject(message)) return;
      add(errors, stringLengthBetween(message.speaker, 2, 100), `${label} needs a speaker.`);
      add(errors, stringLengthBetween(message.text, 2, 600), `${label} text must be 2–600 characters.`);
      add(errors, (policy.allowedMessageKinds ?? []).includes(message.kind), `${label} has an unsupported kind.`);
      add(errors, typeof (message.reaction ?? "") === "string", `${label}.reaction must be a string.`);
      if (message.kind === "public") {
        add(errors, message.text.trim().length <= maxPublic, `${label} exceeds the ${maxPublic}-character public-excerpt limit.`);
        add(errors, isHttpsUrl(message.sourceUrl), `${label} must include an HTTPS sourceUrl.`);
        add(errors, sourceUrls.has(message.sourceUrl), `${label}.sourceUrl must also appear in event.sources.`);
      }
    });
  }

  if (event.quote !== null && event.quote !== undefined) {
    add(errors, isObject(event.quote), `${context}event.quote must be null or an object.`);
    if (isObject(event.quote)) {
      add(errors, stringLengthBetween(event.quote.speaker, 2, 120), `${context}event.quote needs a speaker.`);
      add(errors, stringLengthBetween(event.quote.text, 2, maxPublic), `${context}event.quote exceeds the public-excerpt limit.`);
      add(errors, isHttpsUrl(event.quote.sourceUrl), `${context}event.quote requires an HTTPS sourceUrl.`);
      add(errors, sourceUrls.has(event.quote.sourceUrl), `${context}event.quote.sourceUrl must also appear in event.sources.`);
    }
  }

  if (options.requireEditorialMetadata) {
    const editorial = event.editorial;
    add(errors, isObject(editorial), `${context}published event requires editorial metadata.`);
    if (isObject(editorial)) {
      add(errors, Number.isInteger(editorial.issueNumber) && editorial.issueNumber > 0, `${context}editorial.issueNumber is required.`);
      add(errors, isHttpsUrl(editorial.issueUrl), `${context}editorial.issueUrl must be HTTPS.`);
      add(errors, stringLengthBetween(editorial.approvedBy, 1, 100), `${context}editorial.approvedBy is required.`);
      add(errors, !Number.isNaN(new Date(editorial.approvedAt).valueOf()), `${context}editorial.approvedAt must be a valid timestamp.`);
      add(errors, isSha256(editorial.fingerprint), `${context}editorial.fingerprint must be a lowercase SHA-256 value.`);
      const minimumSources = Number(policy.minimumSources ?? 2);
      const hasEnoughSources = Array.isArray(event.sources) && event.sources.length >= minimumSources;
      const hasException = stringLengthBetween(editorial.singleSourceException, 20, 600);
      add(errors, hasEnoughSources || hasException,
        `${context}published event needs at least ${minimumSources} sources or a written single-source exception.`);
    }
  }

  return errors;
}

export function validateApprovedBundle(bundle, policy, options = {}) {
  const errors = [];
  add(errors, isObject(bundle), "Editorial bundle must be an object.");
  if (!isObject(bundle)) return errors;

  add(errors, bundle.schemaVersion === 1, "schemaVersion must be 1.");
  add(errors, bundle.status === "approved", "status must be changed from draft to approved.");
  add(errors, isObject(bundle.ingestion), "ingestion metadata is missing.");
  if (isObject(bundle.ingestion)) {
    add(errors, isSha256(bundle.ingestion.fingerprint), "ingestion.fingerprint must be the original lowercase SHA-256 value.");
    if (options.expectedFingerprint) {
      add(errors, bundle.ingestion.fingerprint === options.expectedFingerprint,
        "ingestion.fingerprint must match the immutable candidate fingerprint marker in the issue body.");
    }
  }

  errors.push(...validateEvent(bundle.event, policy));

  const factCheck = bundle.factCheck;
  add(errors, isObject(factCheck), "factCheck is missing.");
  if (isObject(factCheck)) {
    for (const field of policy.factCheckFields ?? []) {
      add(errors, factCheck[field] === true, `factCheck.${field} must be true.`);
    }
    const minimumSources = Number(policy.minimumSources ?? 2);
    const hasEnoughSources = Array.isArray(bundle.event?.sources) && bundle.event.sources.length >= minimumSources;
    const hasException = stringLengthBetween(factCheck.singleSourceException, 20, 600);
    add(errors, factCheck.twoSourceRuleMet === true || hasException,
      `factCheck.twoSourceRuleMet must be true, or singleSourceException must explain why fewer than ${minimumSources} sources were used.`);
    if (factCheck.twoSourceRuleMet === true) {
      add(errors, hasEnoughSources, `twoSourceRuleMet is true, but fewer than ${minimumSources} sources are listed.`);
    }
  }

  const labels = new Set(options.labels ?? []);
  for (const label of policy.requiredApprovalLabels ?? []) {
    add(errors, labels.has(label), `Issue is missing the required '${label}' label.`);
  }

  return errors;
}

export function assertValid(errors, heading = "Validation failed") {
  if (!errors.length) return;
  throw new Error(`${heading}:\n- ${errors.join("\n- ")}`);
}
