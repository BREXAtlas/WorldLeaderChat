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

export function createDraftBundle(candidate, now = new Date()) {
  const candidateDate = String(candidate.publishedAt ?? "").slice(0, 10);
  const eventDate = isCalendarDate(candidateDate) ? candidateDate : now.toISOString().slice(0, 10);
  const year = Number(eventDate.slice(0, 4));
  const sourceTitle = sanitizeUntrustedText(candidate.title);
  const sourceExcerpt = sanitizeUntrustedText(candidate.excerpt || sourceTitle).slice(0, 900);
  const publisher = sanitizeUntrustedText(candidate.publisher || "Unknown publisher").slice(0, 120);
  const id = `${eventDate}-${slugify(sourceTitle, 64)}`;

  return {
    schemaVersion: 1,
    status: "draft",
    ingestion: {
      fingerprint: candidate.fingerprint,
      ingestedAt: now.toISOString(),
      relevanceScore: candidate.relevanceScore,
      matchedKeywords: candidate.matchedKeywords,
      sourceId: candidate.sourceId,
      sourcePublishedAt: candidate.publishedAt
    },
    event: {
      id,
      eventDate,
      year,
      date: formatHumanDate(eventDate),
      title: `[EDITOR: WRITE SATIRICAL HEADLINE] ${sourceTitle.toUpperCase()}`,
      kicker: "[EDITOR: Write a one-sentence factual setup with a satirical edge.]",
      category: candidate.category || "World Affairs",
      summary: sourceExcerpt,
      sources: [
        {
          label: sourceTitle,
          url: candidate.url,
          publisher
        }
      ],
      messages: [
        {
          speaker: "UN Admin",
          text: "[EDITOR: Write the opening fictional system message.]",
          kind: "system",
          reaction: ""
        },
        {
          speaker: "World Leader",
          text: "[EDITOR: Write a fictional satirical response grounded in public personality and policy.]",
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
      twoSourceRuleMet: false,
      singleSourceException: ""
    },
    approval: {
      reviewNotes: ""
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
  return `<!-- WLC_NEWS_CANDIDATE -->
<!-- WLC_FINGERPRINT: ${candidate.fingerprint} -->

# Editorial candidate

**Source headline:** ${headline}

**Publisher:** ${publisher}<br>
**Published:** ${candidate.publishedAt ?? "Feed did not provide a usable date"}<br>
**Relevance score:** ${candidate.relevanceScore}<br>
**Matched terms:** ${keywords}

**Original report:** ${candidate.url}

## What the editor must do

1. Open the original report and add a second reliable source. A one-source exception requires a written reason.
2. Edit only the JSON between the machine markers below. Replace every \`[EDITOR: ...]\` placeholder.
3. Write the verified summary first, then the clearly fictional chat. Brief genuine quotations must use \`kind: "public"\` and include \`sourceUrl\`.
4. Set \`status\` to \`approved\`; complete every fact-check field; use \`tone: "sober"\` for tragedy, deaths, disasters or active hostage situations.
5. Apply the **fact-checked** label, then the **editorial-approved** label. Publication begins only after both labels exist and the labeler has write permission.

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
