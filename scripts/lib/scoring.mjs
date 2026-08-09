import { cleanWhitespace } from "./io.mjs";

function normalize(value) {
  return cleanWhitespace(value).toLowerCase();
}

function termHits(text, terms) {
  return terms.filter((term) => text.includes(String(term).toLowerCase()));
}

export function suggestCategory(item) {
  const text = normalize(`${item.title} ${item.excerpt}`);
  const categories = [
    ["Election", ["election", "vote", "ballot", "inauguration", "campaign"]],
    ["War & Security", ["war", "airstrike", "missile", "invasion", "military", "ceasefire", "hostage"]],
    ["Diplomacy", ["summit", "talks", "negotiations", "agreement", "state visit", "diplomatic"]],
    ["Trade", ["tariff", "trade", "sanctions", "export", "import"]],
    ["Alliance", ["nato", "g7", "g20", "alliance", "treaty"]],
    ["Breaking", ["breaking", "crisis", "emergency", "coup"]]
  ];
  return categories.find(([, terms]) => terms.some((term) => text.includes(term)))?.[0] ?? "World Affairs";
}

export function scoreStory(item, relevance = {}) {
  const title = normalize(item.title);
  const body = normalize(item.excerpt);
  const combined = `${title} ${body}`;

  const leaderHits = termHits(combined, relevance.leaderTerms ?? []);
  const highValueHits = termHits(combined, relevance.highValueTerms ?? []);
  const supportingHits = termHits(combined, relevance.supportingTerms ?? []);
  const downrankHits = termHits(combined, relevance.downrankTerms ?? []);

  let score = Number(item.sourceWeight ?? 0);
  score += leaderHits.length * 4;
  score += highValueHits.length * 3;
  score += Math.min(supportingHits.length, 4);
  score -= downrankHits.length * 5;

  for (const term of [...leaderHits, ...highValueHits]) {
    if (title.includes(term)) score += 2;
  }
  if (leaderHits.length && highValueHits.length) score += 3;
  if (/\b(president|prime minister|chancellor|supreme leader)\b/.test(title)) score += 2;

  return {
    score,
    matchedKeywords: [...new Set([...leaderHits, ...highValueHits, ...supportingHits])],
    downrankedBy: downrankHits,
    category: suggestCategory(item)
  };
}
