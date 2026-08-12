import { cleanWhitespace } from "./io.mjs";

const US_DOMESTIC_PATTERN = /\b(?:nfl|nba|wnba|mlb|nhl|ncaa|mls|nwsl|pga tour|fedex cup|super bowl|world series|stanley cup|march madness|college football|college basketball|minor league baseball|american league|national league|afc|nfc)\b/i;
const INTERNATIONAL_PATTERN = /\b(?:premier league|champions league|europa league|world cup|fifa|uefa|euro 20\d{2}|la liga|bundesliga|serie a|ligue 1|formula 1|f1|six nations|cricket|rugby|england|scotland|wales|great britain|british|european|south america|copa am[eé]rica|africa cup of nations)\b/i;
const US_EXPLICIT_PATTERN = /\b(?:u\.?s\.?a?|united states|team usa|usmnt|uswnt|american)\b/i;

/**
 * Classify the event being covered, not merely the home country of its outlet.
 * A BBC report about the NBA is U.S. sports; an ESPN report about the World Cup
 * is international sports.
 */
export function classifySportsCoverageMarket(item = {}) {
  const text = cleanWhitespace(`${item.title || ""} ${item.excerpt || ""}`);
  if (US_DOMESTIC_PATTERN.test(text)) return "US";
  if (INTERNATIONAL_PATTERN.test(text)) return "international";
  if (US_EXPLICIT_PATTERN.test(text)) return "US";
  return String(item.sourceMarket || "").toUpperCase() === "US" ? "US" : "international";
}
