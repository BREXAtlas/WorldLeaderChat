"use strict";

(function installWorldLeaderChatTaxonomy(global) {
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

  const COLORS = Object.freeze({
    "War & Security": "#a30d16",
    "World News": "#364552",
    "Politics & Society": "#153e75",
    "Technology & AI": "#5d2a91",
    "Science & Space": "#006b63",
    "Business & Power": "#8a4b08",
    "Culture & Entertainment": "#9b175c",
    "Sports & Soft Power": "#26723a"
  });

  const ALIASES = new Map([
    ["war & security", "War & Security"],
    ["world news", "World News"],
    ["politics & society", "Politics & Society"],
    ["technology & ai", "Technology & AI"],
    ["science & space", "Science & Space"],
    ["business & power", "Business & Power"],
    ["trade & economy", "Business & Power"],
    ["culture & entertainment", "Culture & Entertainment"],
    ["sports & soft power", "Sports & Soft Power"],
    ["election", "Politics & Society"],
    ["elections", "Politics & Society"],
    ["courts & congress", "Politics & Society"],
    ["health & society", "Politics & Society"]
  ]);

  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function searchableText(event) {
    const article = event?.article || {};
    return normalize([
      event?.title,
      event?.kicker,
      event?.category,
      event?.summary,
      event?.meme,
      event?.date,
      event?.eventDate,
      article.headline,
      article.dek,
      ...(article.body || []),
      ...(event?.sources || []).flatMap((source) => [source.publisher, source.label]),
      ...(event?.messages || []).flatMap((message) => [message.speaker, message.text]),
      event?.editorial?.issueNumber ? `issue ${event.editorial.issueNumber}` : ""
    ].join(" "));
  }

  function sectionFor(event) {
    const explicit = ALIASES.get(String(event?.category || "").toLowerCase().trim());
    if (explicit) return explicit;

    const text = searchableText(event);
    if (/\bwar\b|security|airstrike|missile|military|hostage|ceasefire|invasion|nuclear|gaza|ukraine|battlefield|armed conflict/.test(text)) return "War & Security";
    if (/technology|artificial intelligence|\bai\b|cyber|tiktok|openai|chip|semiconductor|software|robot/.test(text)) return "Technology & AI";
    if (/science|space|rocket|nasa|spacex|moon|mars|telescope|asteroid|discovery|research/.test(text)) return "Science & Space";
    if (/business|economy|trade|tariff|market|company|billionaire|antitrust|merger|bank|finance|chief executive|\bceo\b/.test(text)) return "Business & Power";
    if (/culture|entertainment|music|song|album|film|movie|television|streaming|actor|podcast|book|copyright|theater|theatre/.test(text)) return "Culture & Entertainment";
    if (/sports|sport|olympics|world cup|championship|medal|fifa|athlete|tournament|gymnastics|football|basketball|baseball|soccer|tennis/.test(text)) return "Sports & Soft Power";
    if (/election|congress|senate|court|immigration|border|protest|civil rights|health|society|campaign|governor|parliament|vote|ballot/.test(text)) return "Politics & Society";
    return "World News";
  }

  function matchesSearch(event, query) {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    if (!terms.length) return true;
    const haystack = `${searchableText(event)} ${normalize(sectionFor(event))}`;
    return terms.every((term) => haystack.includes(term));
  }

  global.WLC_NEWSROOM = Object.freeze({
    desks: DESKS,
    colors: COLORS,
    normalize,
    searchableText,
    sectionFor,
    matchesSearch
  });
})(globalThis);
