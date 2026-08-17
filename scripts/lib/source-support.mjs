const STOPWORDS = new Set([
  "about", "after", "again", "against", "also", "another", "because", "been", "before", "being", "between", "both",
  "but", "called", "clear", "could", "details", "from", "have", "into", "more", "most", "only", "part", "said", "says",
  "sparse", "than", "that", "their", "them", "there", "these", "they", "this", "those", "through", "under", "very", "what",
  "when", "where", "which", "while", "with", "would"
]);

const CONCRETE_CLAIM = /\b(?:announc(?:e|ed|ing)|arrest(?:ed)?|attack(?:ed)?|ban(?:ned)?|call(?:ed)?|cancel(?:led)?|claim(?:ed)?|compel(?:led)?|confirm(?:ed)?|demand(?:ed)?|deny|denied|dismiss(?:ed)?|elect(?:ed)?|face[ds]?|fir(?:e|ed|ing)|hold|held|hope[ds]?|jail(?:ed)?|kill(?:ed)?|launch(?:ed)?|lose|lost|meet|met|order(?:ed)?|plan(?:ned)?|post(?:ed)?|promise[ds]?|quit|reject(?:ed)?|resign(?:ed)?|say|said|sign(?:ed)?|suspend(?:ed)?|taunt(?:ed)?|vote[ds]?|want(?:ed)?|win|won)\b|[$€£%]|\b\d+(?:[.,]\d+)?\b/i;

function stem(token) {
  return token
    .replace(/(?:ies)$/i, "y")
    .replace(/(?:ing|ers|er|ed|es|s)$/i, "");
}

function normalizedTokens(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&(?:#x27|#39|apos);/gi, "'")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token))
    .map(stem)
    .filter((token) => token.length >= 3);
}

function properNames(value) {
  const text = String(value || "");
  return [...text.matchAll(/\b[A-Z][A-Za-z'’-]{2,}\b/g)]
    .filter((match) => !["The", "This", "That", "After", "Before", "Source", "Audit"].includes(match[0]))
    .filter((match) => !/^(?:i|we|you|he|she|it|they|that|there|what|who|let)['’][a-z]+$/i.test(match[0]))
    .filter((match) => {
      const prefix = text.slice(0, match.index).trimEnd();
      return prefix && !/[.!?]$/.test(prefix);
    })
    .map((match) => match[0]);
}

export function claimClearlySupported(claim, sourceRecord) {
  const source = String(sourceRecord || "").toLowerCase();
  if (properNames(claim).some((name) => !source.includes(name.toLowerCase()))) return false;
  const claimTokens = [...new Set(normalizedTokens(claim))];
  const sourceTokens = new Set(normalizedTokens(sourceRecord));
  if (claimTokens.length < 3) return false;
  const matched = claimTokens.filter((token) => sourceTokens.has(token));
  return matched.length >= 4 && matched.length / claimTokens.length >= 0.65;
}

export function auditClaimNeedsReview(claim, sourceRecord) {
  const value = String(claim || "").replace(/^[^:]{2,100}:\s*/, "").trim();
  if (!value || claimClearlySupported(value, sourceRecord)) return false;
  const source = String(sourceRecord || "").toLowerCase();
  const introducesName = properNames(value).some((name) => !source.includes(name.toLowerCase()));
  return introducesName || CONCRETE_CLAIM.test(value);
}
