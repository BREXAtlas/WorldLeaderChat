import { cleanWhitespace, sha256, slugify } from "./io.mjs";

export const STORY_JSON_START = "<!-- WLC_STORY_JSON_START -->";
export const STORY_JSON_END = "<!-- WLC_STORY_JSON_END -->";
export const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;

function isCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""))) return false;
  const [year, month, day] = String(value).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function dateKeyInTimeZone(value, timeZone = "America/Chicago") {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function sanitizeUntrustedText(value) {
  return cleanWhitespace(value)
    .replaceAll(STORY_JSON_START, "[machine marker removed]")
    .replaceAll(STORY_JSON_END, "[machine marker removed]")
    .replace(/<!--/g, "&lt;!--")
    .replace(/-->/g, "--&gt;");
}

export function formatHumanDate(isoDate) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(date.valueOf())) return isoDate;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC"
  }).format(date);
}

export function candidateFingerprint(item) {
  return sha256(`${cleanWhitespace(item.title).toLowerCase()}|${item.url}`);
}

function candidateSources(candidate, sourceTitle, publisher) {
  const incoming = Array.isArray(candidate.sources) && candidate.sources.length
    ? candidate.sources
    : [{ label: sourceTitle, url: candidate.url, publisher }];
  const seen = new Set();
  return incoming
    .map((source) => ({
      label: sanitizeUntrustedText(source.label || source.title || sourceTitle).slice(0, 300),
      url: String(source.url || candidate.url),
      publisher: sanitizeUntrustedText(source.publisher || publisher).slice(0, 120)
    }))
    .filter((source) => source.url && !seen.has(source.url) && seen.add(source.url));
}

export function createDraftBundle(candidate, now = new Date()) {
  const candidateDate = dateKeyInTimeZone(candidate.publishedAt);
  const today = dateKeyInTimeZone(now);
  const eventDate = isCalendarDate(candidateDate) ? candidateDate : today;
  const year = Number(eventDate.slice(0, 4));
  const sourceTitle = sanitizeUntrustedText(candidate.title);
  const sourceExcerpt = sanitizeUntrustedText(candidate.excerpt || sourceTitle).slice(0, 1200);
  const publisher = sanitizeUntrustedText(candidate.publisher || "Unknown publisher").slice(0, 120);
  const id = `${eventDate}-${slugify(sourceTitle, 64)}`;
  const sources = candidateSources(candidate, sourceTitle, publisher);

  return {
    schemaVersion: 1,
    status: "draft",
    ingestion: {
      fingerprint: candidate.fingerprint,
      ingestedAt: now.toISOString(),
      relevanceScore: candidate.relevanceScore,
      matchedKeywords: candidate.matchedKeywords,
      sourceId: candidate.sourceId,
      sourceDesk: candidate.sourceDesk || "World News",
      newsroomDesk: candidate.newsroomDesk || candidate.category || candidate.sourceDesk || "World News",
      sourcePublishedAt: candidate.publishedAt,
      newsroomFormat: 2,
      coveragePublishers: candidate.coveragePublishers || sources.map((source) => source.publisher)
    },
    event: {
      id,
      eventDate,
      year,
      date: formatHumanDate(eventDate),
      title: `[EDITOR: REWRITE AS A TRUTHFUL, SHARP HEADLINE] ${sourceTitle.toUpperCase()}`,
      kicker: "[EDITOR: Write one engaging line that frames the real event with a dry, sarcastic edge.]",
      category: candidate.newsroomDesk || candidate.category || candidate.sourceDesk || "World News",
      summary: sourceExcerpt,
      article: {
        headline: "[EDITOR: Write a catchy factual article headline.]",
        dek: "[EDITOR: Write a one-sentence factual deck with a restrained sarcastic angle.]",
        body: [
          "[EDITOR: Write a 3–5 paragraph short article. Every factual assertion must be supported by the listed sources. Report the real event clearly, use wit in framing rather than inventing facts, and let the article read as though the group chat exposed the subtext.]"
        ],
        sourceCredit: `Original reporting credited below to ${sources.map((source) => source.publisher).join(", ")}.`
      },
      sources,
      messages: [
        {
          speaker: "[EDITOR: Name a person or institution directly involved]",
          text: "[EDITOR: Open with that participant's direct position, challenge or reaction to the real event.]",
          kind: "satire",
          reaction: ""
        },
        {
          speaker: "World Leader",
          text: "[EDITOR: Write a plausible fictional reaction grounded in public personality, policy and the verified event.]",
          kind: "satire",
          reaction: ""
        }
      ],
      meme: "[EDITOR: WRITE THE SCREENSHOT-WORTHY FINAL LINE.]",
      quote: null,
      tone: "comic"
    },
    factCheck: {
      sourceOpened: false,
      summaryVerified: false,
      namesAndTitlesVerified: false,
      publicQuotesVerified: false,
      satireTargetsPowerNotVictims: false,
      sensitiveEventReview: false,
      clearSatireLabel: true,
      articleMatchesSources: false,
      twoSourceRuleMet: false,
      singleSourceException: ""
    },
    approval: {
      reviewNotes: "",
      articleStyle: "truth-first-sarcastic-news",
      conversationStyle: "back-and-forth",
      targetMessageCount: "10-14"
    }
  };
}

export function createEditorialIssueBody(candidate, repositoryUrl) {
  const bundle = createDraftBundle(candidate);
  const headline = sanitizeUntrustedText(candidate.title);
  const publisher = sanitizeUntrustedText(candidate.publisher || "Unknown publisher");
  const keywords = Array.isArray(candidate.matchedKeywords) && candidate.matchedKeywords.length
    ? candidate.matchedKeywords.map(sanitizeUntrustedText).join(", ")
    : "none";
  const coverage = (candidate.coveragePublishers || [publisher]).join(", ");
  return `<!-- WLC_NEWS_CANDIDATE -->
<!-- WLC_FINGERPRINT: ${candidate.fingerprint} -->

# Editorial candidate

**Source headline:** ${headline}

**Primary publisher:** ${publisher}<br>
**Coverage included:** ${coverage}<br>
**Published:** ${candidate.publishedAt ?? "Feed did not provide a usable date"}<br>
**Desk:** ${candidate.sourceDesk || "World News"}<br>
**Relevance score:** ${candidate.relevanceScore}<br>
**Matched terms:** ${keywords}

**Original report:** ${candidate.url}

## Approval standard

The drafting system prepares the short article and conversation. The editor approves, regenerates or rejects the completed recommendation.

1. The event, names, chronology and conclusion must match the listed original reporting.
2. The article may be dry, sarcastic and engaging, but it may not invent an event, quote, motive or result.
3. Wit belongs in framing, comparisons and plausible private reactions—not in unsupported factual claims.
4. The conversation should contain 10–14 messages with actual back-and-forth interaction.
5. Genuine quotations must use \`kind: "public"\` and include a matching \`sourceUrl\`.
6. Sensitive stories must target powerful people, policy and messaging rather than victims.

Editorial policy: ${repositoryUrl}/blob/main/docs/EDITORIAL_WORKFLOW.md

${STORY_JSON_START}
\`\`\`json
${JSON.stringify(bundle, null, 2)}
\`\`\`
${STORY_JSON_END}
`;
}

export function extractCandidateFingerprint(issueBody) {
  const match = String(issueBody ?? "").match(/<!--\s*WLC_FINGERPRINT:\s*([a-f0-9]{64})\s*-->/i);
  if (!match) throw new Error("Issue body is missing a valid 64-character candidate fingerprint marker.");
  return match[1].toLowerCase();
}

export function extractStoryBundle(issueBody) {
  const body = String(issueBody ?? "");
  const starts = body.split(STORY_JSON_START).length - 1;
  const ends = body.split(STORY_JSON_END).length - 1;
  if (starts !== 1 || ends !== 1) {
    throw new Error("Issue body must contain exactly one World Leader Chat JSON marker pair.");
  }
  const start = body.indexOf(STORY_JSON_START);
  const end = body.indexOf(STORY_JSON_END);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error("Issue body is missing the World Leader Chat JSON markers.");
  }
  let jsonText = body.slice(start + STORY_JSON_START.length, end).trim();
  jsonText = jsonText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    return JSON.parse(jsonText);
  } catch (error) {
    throw new Error(`The editorial JSON is invalid: ${error.message}`, { cause: error });
  }
}
