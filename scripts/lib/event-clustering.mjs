import { cleanWhitespace } from "./io.mjs";

const STOPWORDS = new Set([
  "a","an","and","are","as","at","be","by","for","from","has","have","in","is","it","its","of","on","s","says","say","the","to","us","with","after","amid","latest","live","news","update","updates","new","report"
]);

function tokens(value, minimumLength = 3) {
  return cleanWhitespace(value)
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((term) => term.length >= minimumLength && !STOPWORDS.has(term));
}

export function topicTerms(value) {
  return new Set(tokens(value));
}

export function topicBigrams(value) {
  const values = tokens(value, 2);
  return new Set(values.slice(0, -1).map((term, index) => `${term} ${values[index + 1]}`));
}

function hoursApart(a, b) {
  const left = new Date(a || 0).valueOf();
  const right = new Date(b || 0).valueOf();
  if (!Number.isFinite(left) || !Number.isFinite(right) || !left || !right) return 0;
  return Math.abs(left - right) / 3600000;
}

export function sameNewsEvent(a, b) {
  if (hoursApart(a.publishedAt, b.publishedAt) > 36) return false;
  const left = a.topicTerms;
  const right = b.topicTerms;
  const intersection = [...left].filter((term) => right.has(term)).length;
  const union = new Set([...left, ...right]).size || 1;
  const jaccard = intersection / union;
  const matchingBigrams = [...(a.topicBigrams || [])]
    .filter((bigram) => (b.topicBigrams || new Set()).has(bigram)).length;
  return jaccard >= 0.48 || (intersection >= 4 && jaccard >= 0.31) || matchingBigrams >= 2;
}
