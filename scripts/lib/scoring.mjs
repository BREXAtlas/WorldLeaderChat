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
    ["Election", ["election", "vote", "ballot", "inauguration", "campaign", "midterm", "poll"]],
    ["Courts & Congress", ["supreme court", "court ruling", "lawsuit", "congress", "senate", "house committee", "subpoena"]],
    ["War & Security", ["war", "airstrike", "missile", "invasion", "military", "ceasefire", "hostage", "nuclear"]],
    ["Diplomacy", ["summit", "talks", "negotiations", "agreement", "state visit", "diplomatic", "consulate", "embassy"]],
    ["Trade & Economy", ["tariff", "trade", "sanctions", "export", "import", "economy", "inflation", "markets"]],
    ["Technology & AI", ["artificial intelligence", " ai ", "ai model", "openai", "robot", "semiconductor", "chip", "tiktok", "social media", "cyber"]],
    ["Science & Space", ["rocket", "spacecraft", "space launch", "moon", "mars", "nasa", "spacex", "blue origin", "telescope", "discovery", "asteroid"]],
    ["Business & Power", ["chief executive", " ceo ", "billionaire", "company", "antitrust", "merger", "tesla", "amazon", "meta"]],
    ["Culture & Entertainment", ["music", "song", "album", "tour", "film", "movie", "television", "hbo", "streaming", "actor", "comedian", "copyright"]],
    ["Sports & Soft Power", ["olympics", "world cup", "championship", "medal", "fifa", "sports diplomacy"]],
    ["Climate & Disaster", ["climate", "wildfire", "hurricane", "earthquake", "flood", "disaster", "heatwave"]],
    ["Health & Society", ["health", "pandemic", "outbreak", "immigration", "deportation", "protest", "civil rights"]],
    ["Alliance", ["nato", "g7", "g20", "alliance", "treaty"]],
    ["Breaking", ["breaking", "crisis", "emergency", "coup"]]
  ];
  const match = categories.find(([, terms]) => terms.some((term) => text.includes(term)));
  return match?.[0] ?? item.sourceDesk ?? "World News";
}

export function scoreStory(item, relevance = {}) {
  const title = normalize(item.title);
  const body = normalize(item.excerpt);
  const combined = ` ${title} ${body} `;

  const leaderHits = termHits(combined, relevance.leaderTerms ?? []);
  const adjacentHits = termHits(combined, relevance.adjacentPeopleTerms ?? []);
  const highValueHits = termHits(combined, relevance.highValueTerms ?? []);
  const worldNewsHits = termHits(combined, relevance.worldNewsTerms ?? []);
  const supportingHits = termHits(combined, relevance.supportingTerms ?? []);
  const downrankHits = termHits(combined, relevance.downrankTerms ?? []);

  let score = Number(item.sourceWeight ?? 0);
  score += leaderHits.length * 4;
  score += adjacentHits.length * 3;
  score += highValueHits.length * 3;
  score += worldNewsHits.length * 2;
  score += Math.min(supportingHits.length, 5);
  score -= downrankHits.length * 6;

  for (const term of [...leaderHits, ...adjacentHits, ...highValueHits, ...worldNewsHits]) {
    if (title.includes(term)) score += 2;
  }

  if (leaderHits.length && (highValueHits.length || worldNewsHits.length || adjacentHits.length)) score += 4;
  if (adjacentHits.length && (leaderHits.length || highValueHits.length || supportingHits.length)) score += 3;
  if (highValueHits.length >= 2 && worldNewsHits.length) score += 2;
  if (/\b(president|prime minister|chancellor|supreme leader|senator|governor|congressman|congresswoman)\b/.test(title)) score += 2;

  // A major science, technology, business or culture story may qualify without a politician
  // when it has global/national significance and a plausible world-leader-adjacent angle.
  const broadDesk = /Technology|Science|Business|Culture|Sports/.test(item.sourceDesk ?? "");
  if (broadDesk && worldNewsHits.length >= 1 && (adjacentHits.length || highValueHits.length >= 1)) score += 4;

  return {
    score,
    matchedKeywords: [...new Set([
      ...leaderHits,
      ...adjacentHits,
      ...highValueHits,
      ...worldNewsHits,
      ...supportingHits
    ])],
    downrankedBy: downrankHits,
    category: suggestCategory(item)
  };
}
