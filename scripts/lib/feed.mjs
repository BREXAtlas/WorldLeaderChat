import { cleanWhitespace, normalizeUrl } from "./io.mjs";

const NAMED_ENTITIES = new Map([
  ["amp", "&"],
  ["lt", "<"],
  ["gt", ">"],
  ["quot", '"'],
  ["apos", "'"],
  ["nbsp", " "],
  ["hellip", "…"],
  ["ndash", "–"],
  ["mdash", "—"],
  ["rsquo", "’"],
  ["lsquo", "‘"],
  ["rdquo", "”"],
  ["ldquo", "“"]
]);

export function decodeEntities(value) {
  return String(value ?? "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(x?[0-9a-f]+);/gi, (_, raw) => {
      const radix = raw.toLowerCase().startsWith("x") ? 16 : 10;
      const number = Number.parseInt(raw.replace(/^x/i, ""), radix);
      return Number.isFinite(number) ? String.fromCodePoint(number) : _;
    })
    .replace(/&([a-z]+);/gi, (match, name) => NAMED_ENTITIES.get(name.toLowerCase()) ?? match);
}

export function stripHtml(value) {
  return cleanWhitespace(
    decodeEntities(value)
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/p>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  );
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractTag(block, names) {
  for (const name of names) {
    const escaped = escapeRegex(name);
    const pattern = name.includes(":")
      ? escaped
      : `(?:[\\w-]+:)?${escaped}`;
    const match = block.match(new RegExp(`<${pattern}\\b[^>]*>([\\s\\S]*?)<\\/${pattern}>`, "i"));
    if (match) return decodeEntities(match[1]).trim();
  }
  return "";
}

function extractLink(block) {
  const alternate = block.match(/<link\b[^>]*\brel=["']alternate["'][^>]*\bhref=["']([^"']+)["'][^>]*>/i)
    ?? block.match(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/i);
  if (alternate) return normalizeUrl(decodeEntities(alternate[1]));

  const rssLink = extractTag(block, ["link"]);
  if (/^https?:\/\//i.test(rssLink)) return normalizeUrl(rssLink);

  const guid = extractTag(block, ["guid", "id"]);
  if (/^https?:\/\//i.test(guid)) return normalizeUrl(guid);
  return "";
}

function blocksFor(xml, tag) {
  const escaped = escapeRegex(tag);
  return [...String(xml).matchAll(new RegExp(`<${escaped}\\b[^>]*>([\\s\\S]*?)<\\/${escaped}>`, "gi"))]
    .map((match) => match[1]);
}

export function parseFeed(xml, source = {}) {
  const raw = String(xml ?? "");
  let blocks = blocksFor(raw, "item");
  if (!blocks.length) blocks = blocksFor(raw, "entry");

  return blocks.slice(0, 150).map((block) => {
    const title = stripHtml(extractTag(block, ["title"]));
    const url = extractLink(block);
    const publishedRaw = extractTag(block, ["pubDate", "published", "updated", "dc:date", "date"]);
    const parsedDate = publishedRaw ? new Date(publishedRaw) : null;
    const description = extractTag(block, ["description", "summary", "content:encoded", "content"]);
    const guid = stripHtml(extractTag(block, ["guid", "id"])) || url;

    return {
      sourceId: source.id ?? "unknown",
      publisher: source.publisher ?? "Unknown publisher",
      sourceWeight: Number(source.weight ?? 0),
      title,
      url,
      guid,
      excerpt: stripHtml(description).slice(0, 1000),
      publishedAt: parsedDate && !Number.isNaN(parsedDate.valueOf()) ? parsedDate.toISOString() : null
    };
  }).filter((item) => item.title && item.url);
}
