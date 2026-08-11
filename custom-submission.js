"use strict";

(function installWorldLeaderChatCustomSubmission() {
  const STORY_JSON_START = "<!-- WLC_STORY_JSON_START -->";
  const STORY_JSON_END = "<!-- WLC_STORY_JSON_END -->";
  const DESKS = Object.freeze([
    "War & Security",
    "World News",
    "Politics & Society",
    "Technology & AI",
    "Science & Space",
    "Business & Power",
    "Culture & Entertainment",
    "Sports & Soft Power"
  ]);

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function slugify(value, maximum = 72) {
    return clean(value)
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, maximum)
      .replace(/-$/g, "") || "custom-editorial-file";
  }

  function chicagoDate(now = new Date()) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(now);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  function humanDate(isoDate) {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      year: "numeric",
      month: "long",
      day: "numeric"
    }).format(new Date(`${isoDate}T12:00:00Z`));
  }

  function publisherFromUrl(value) {
    const host = new URL(value).hostname.toLowerCase().replace(/^www\./, "");
    if (host === "youtu.be" || host.endsWith("youtube.com")) return "YouTube";
    const known = {
      "cnn.com": "CNN",
      "cbsnews.com": "CBS News",
      "newsnationnow.com": "NewsNation",
      "reuters.com": "Reuters",
      "apnews.com": "Associated Press",
      "theguardian.com": "The Guardian",
      "nytimes.com": "The New York Times",
      "washingtonpost.com": "The Washington Post"
    };
    return known[host] || host.split(".").slice(0, -1).join(".").replace(/(^|[.-])\w/g, (match) => match.toUpperCase());
  }

  function validate(input) {
    const topic = clean(input?.topic);
    const notes = clean(input?.notes);
    const desk = clean(input?.desk);
    const rawUrls = Array.isArray(input?.urls) ? input.urls : String(input?.urls || "").split(/[\r\n,]+/);
    const urls = [...new Set(rawUrls.map((value) => String(value || "").trim()).filter(Boolean))];
    const problems = [];
    if (topic.length < 12 || topic.length > 180) problems.push("Story/topic must be 12–180 characters.");
    if (notes.length < 40 || notes.length > 2400) problems.push("Verified facts/context must be 40–2400 characters.");
    if (!DESKS.includes(desk)) problems.push("Choose a valid newsroom desk.");
    if (!urls.length || urls.length > 5) problems.push("Add 1–5 source links.");
    for (const value of urls) {
      try {
        const url = new URL(value);
        if (url.protocol !== "https:" || url.username || url.password) throw new Error();
      } catch {
        problems.push(`Source must be a public HTTPS link: ${value}`);
      }
    }
    return { problems, topic, notes, desk, urls };
  }

  async function sha256(value) {
    const bytes = new TextEncoder().encode(value);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  async function createBundle(input, now = new Date()) {
    const valid = validate(input);
    if (valid.problems.length) throw new Error(valid.problems.join(" "));
    const eventDate = chicagoDate(now);
    const sources = valid.urls.map((url, index) => {
      const publisher = publisherFromUrl(url);
      return {
        label: index === 0 ? valid.topic : `${publisher} reporting submitted for ${valid.topic}`,
        url,
        publisher
      };
    });
    const fingerprint = await sha256(`${valid.topic}\n${valid.notes}\n${[...valid.urls].sort().join("\n")}`);
    const id = `${eventDate}-${slugify(valid.topic)}`;

    return {
      schemaVersion: 1,
      status: "draft",
      ingestion: {
        fingerprint,
        ingestedAt: now.toISOString(),
        relevanceScore: 100,
        matchedKeywords: ["owner-submitted"],
        sourceId: "custom-editor-submission",
        sourceDesk: valid.desk,
        newsroomDesk: valid.desk,
        sourcePublishedAt: now.toISOString(),
        newsroomFormat: 2,
        coveragePublishers: sources.map((source) => source.publisher),
        customSubmission: true,
        customTopic: valid.topic,
        sourceDigests: [{ publisher: "Editor submission notes", excerpt: valid.notes }]
      },
      event: {
        id,
        eventDate,
        year: Number(eventDate.slice(0, 4)),
        date: humanDate(eventDate),
        title: `[EDITOR: GENERATE FROM SUBMITTED SOURCES] ${valid.topic}`,
        kicker: "[EDITOR: Explain the verified event and its World Leaders Chat angle.]",
        category: valid.desk,
        summary: valid.notes,
        article: {
          headline: "[EDITOR: Write a specific factual headline.]",
          dek: "[EDITOR: Write a factual deck with a restrained sharp angle.]",
          body: ["[EDITOR: Generate a complete 3–5 paragraph source-locked short report from the submitted links and verified notes.]"],
          sourceCredit: "[EDITOR: Credit exactly the linked publishers.]"
        },
        sources,
        messages: [
          { speaker: "UN Admin", text: "[EDITOR: Open the article-specific conversation.]", kind: "system", reaction: "" },
          { speaker: "Newsroom", text: "[EDITOR: Generate direct source-grounded satire.]", kind: "satire", reaction: "" }
        ],
        meme: "[EDITOR: Write the original article-specific Last Word.]",
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
        reviewNotes: "Owner-submitted source links. Automated drafting must finish before human approval.",
        articleStyle: "truth-first-sarcastic-news",
        conversationStyle: "article-specific-direct-chat",
        targetMessageCount: "10-14"
      }
    };
  }

  function issueBody(bundle, repositoryUrl = "https://github.com/BREXAtlas/WorldLeaderChat") {
    const sourceList = bundle.event.sources.map((source) => `- [${source.publisher}: ${source.label}](${source.url})`).join("\n");
    return `<!-- WLC_NEWS_CANDIDATE -->
<!-- WLC_CUSTOM_SUBMISSION -->
<!-- WLC_FINGERPRINT: ${bundle.ingestion.fingerprint} -->

# Custom editorial submission

**Requested topic:** ${bundle.ingestion.customTopic}
**Desk:** ${bundle.event.category}

## Submitted sources

${sourceList}

## Generator contract

The drafting workflow must open/enrich the submitted public links, use the editor notes only as source-checking guidance, create a complete short report and article-specific conversation, and return the file to **Ready for Approval**. Nothing publishes until the owner approves the generated result.

Editorial rules: ${repositoryUrl}/blob/main/docs/NEWSROOM_RULES.md

${STORY_JSON_START}
\`\`\`json
${JSON.stringify(bundle, null, 2)}
\`\`\`
${STORY_JSON_END}
`;
  }

  globalThis.WLC_CUSTOM_SUBMISSION = Object.freeze({
    DESKS,
    createBundle,
    issueBody,
    publisherFromUrl,
    validate
  });
})();
