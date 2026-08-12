"use strict";

(function installWorldLeaderChatNewsroomContract() {
  const contract = Object.freeze({
    version: 1,
    ownerApprovalLabel: "owner-approved-structure",
    recentNewsroomDays: 8,
    article: Object.freeze({
      minimumParagraphs: 3,
      maximumParagraphs: 5,
      minimumParagraphCharacters: 45,
      maximumParagraphCharacters: 1400,
      minimumTotalCharacters: 600,
      maximumTotalCharacters: 5000,
      minimumWords: 100,
      maximumWords: 500
    }),
    requiredArticleActions: Object.freeze([
      "Copy Article + Chat",
      "Copy Social Version",
      "Save Social PNG",
      "Share Social PNG",
      "Save Social Carousel",
      "Share Social Carousel"
    ])
  });

  function publishersFrom(sources) {
    return [...new Set((sources || [])
      .map((source) => String(source?.publisher || "").trim())
      .filter(Boolean))];
  }

  function expectedSourceCredit(sources) {
    const publishers = publishersFrom(sources);
    if (!publishers.length) return "Based on the original reporting linked below.";
    if (publishers.length === 1) return `Based on original reporting from ${publishers[0]}.`;
    if (publishers.length === 2) return `Based on original reporting from ${publishers[0]} and ${publishers[1]}.`;
    return `Based on original reporting from ${publishers.slice(0, -1).join(", ")}, and ${publishers.at(-1)}.`;
  }

  function isCreditParagraph(value) {
    return /^(?:credit|sources?|based on original reporting|original reporting credited)\s*:/i.test(String(value || "").trim())
      || /^(?:based on original reporting|original reporting credited)\b/i.test(String(value || "").trim());
  }

  function wordCount(values) {
    return (Array.isArray(values) ? values.join(" ") : String(values || ""))
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
  }

  function articleProblems(article, sources) {
    const rules = contract.article;
    const problems = [];
    if (!article || typeof article !== "object" || Array.isArray(article)) return ["The short report is missing."];
    const body = Array.isArray(article.body) ? article.body : [];
    const boilerplate = `${article.headline || ""} ${article.dek || ""} ${body.join(" ")}`.toLowerCase();
    if (body.length < rules.minimumParagraphs || body.length > rules.maximumParagraphs) {
      problems.push(`The short report must contain ${rules.minimumParagraphs}–${rules.maximumParagraphs} paragraphs.`);
    }
    body.forEach((paragraph, index) => {
      const length = String(paragraph || "").trim().length;
      if (length < rules.minimumParagraphCharacters || length > rules.maximumParagraphCharacters) {
        problems.push(`Paragraph ${index + 1} must be ${rules.minimumParagraphCharacters}–${rules.maximumParagraphCharacters} characters.`);
      }
      if (isCreditParagraph(paragraph)) problems.push(`Paragraph ${index + 1} is a source credit, not article prose.`);
    });
    const total = body.join(" ").trim().length;
    if (total < rules.minimumTotalCharacters || total > rules.maximumTotalCharacters) {
      problems.push(`The short report must total ${rules.minimumTotalCharacters}–${rules.maximumTotalCharacters} characters.`);
    }
    const words = wordCount(body);
    if (words < rules.minimumWords || words > rules.maximumWords) {
      problems.push(`The short report must contain ${rules.minimumWords}–${rules.maximumWords} words.`);
    }
    const expectedCredit = expectedSourceCredit(sources);
    if (String(article.sourceCredit || "").trim() !== expectedCredit) {
      problems.push("The source credit must name exactly the publishers linked in this file.");
    }
    if (/the reported event is .* the sharper angle is who owns the consequence once the announcement leaves the podium/.test(boilerplate)
      || boilerplate.includes("the original reporting establishes the event, chronology and immediate consequence")
      || boilerplate.includes("the world leader chat angle is the gap between the public announcement and the pressure underneath it")
      || boilerplate.includes("the source record remains the authority. the conversation below is an imagined exchange")) {
      problems.push("The short report uses a recycled fill-in-the-headline article template and must be rewritten from the actual source facts.");
    }
    return problems;
  }

  function recentCutoffISO(todayISO) {
    const match = String(todayISO || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return "";
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    date.setUTCDate(date.getUTCDate() - (contract.recentNewsroomDays - 1));
    return date.toISOString().slice(0, 10);
  }

  function isRecentDate(eventISO, todayISO) {
    const cutoff = recentCutoffISO(todayISO);
    return Boolean(cutoff && /^\d{4}-\d{2}-\d{2}$/.test(String(eventISO || ""))
      && eventISO >= cutoff && eventISO <= todayISO);
  }

  globalThis.WLC_NEWSROOM_CONTRACT = contract;
  globalThis.WLC_ARTICLE_STANDARD = Object.freeze({
    articleProblems,
    expectedSourceCredit,
    isCreditParagraph,
    isRecentDate,
    recentCutoffISO,
    wordCount
  });
})();
