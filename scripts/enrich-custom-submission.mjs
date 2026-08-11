import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { extractStoryBundle, STORY_JSON_END, STORY_JSON_START } from "./lib/editorial.mjs";

const token = process.env.GITHUB_TOKEN || "";
const repository = process.env.GITHUB_REPOSITORY || "BREXAtlas/WorldLeaderChat";
const issueNumber = Number(process.env.WLC_TARGET_ISSUE || 0);
const apiBase = process.env.GITHUB_API_URL || "https://api.github.com";

if (!token) throw new Error("GITHUB_TOKEN is required.");
if (!Number.isInteger(issueNumber) || issueNumber < 1) throw new Error("WLC_TARGET_ISSUE must identify the custom editorial issue.");

async function github(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "world-leader-chat-custom-source-enricher",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`GitHub ${response.status}: ${payload?.message || text}`);
  return payload;
}

function blockedAddress(address) {
  if (address === "::1" || address === "::" || address.toLowerCase().startsWith("fc") || address.toLowerCase().startsWith("fd") || address.toLowerCase().startsWith("fe8") || address.toLowerCase().startsWith("fe9") || address.toLowerCase().startsWith("fea") || address.toLowerCase().startsWith("feb")) return true;
  if (isIP(address) !== 4) return false;
  const [a, b] = address.split(".").map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
}

async function assertPublicHttps(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) throw new Error(`Only public HTTPS source links are allowed: ${value}`);
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) throw new Error(`Local source hosts are not allowed: ${host}`);
  const addresses = await lookup(host, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => blockedAddress(address))) throw new Error(`Source host did not resolve to a public address: ${host}`);
  return url;
}

async function publicFetch(value, redirects = 0) {
  const url = await assertPublicHttps(value);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {
      redirect: "manual",
      signal: controller.signal,
      headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": "WorldLeaderChat/1.0 source preview" }
    });
    if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
      if (redirects >= 3) throw new Error(`Too many redirects while opening ${value}`);
      return publicFetch(new URL(response.headers.get("location"), url).href, redirects + 1);
    }
    if (!response.ok) throw new Error(`Source returned HTTP ${response.status}: ${url.hostname}`);
    const length = Number(response.headers.get("content-length") || 0);
    if (length > 2_000_000) throw new Error(`Source preview is too large: ${url.hostname}`);
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    while (true) {
      const { done, value: chunk } = await reader.read();
      if (done) break;
      total += chunk.length;
      if (total > 2_000_000) throw new Error(`Source preview is too large: ${url.hostname}`);
      chunks.push(chunk);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return { url, html: new TextDecoder().decode(bytes) };
  } finally {
    clearTimeout(timeout);
  }
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)))
    .replace(/\s+/g, " ").trim();
}

function meta(html, names) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const attributes = Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/gi)].map((match) => [match[1].toLowerCase(), match[3]]));
    const name = String(attributes.name || attributes.property || "").toLowerCase();
    if (names.includes(name) && attributes.content) return decodeHtml(attributes.content);
  }
  return "";
}

function publisherFromHost(hostname) {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  const known = { "cnn.com": "CNN", "cbsnews.com": "CBS News", "newsnationnow.com": "NewsNation", "reuters.com": "Reuters", "apnews.com": "Associated Press", "theguardian.com": "The Guardian", "nytimes.com": "The New York Times", "washingtonpost.com": "The Washington Post" };
  return known[host] || host;
}

function youtubeId(url) {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (host === "youtu.be") return url.pathname.split("/").filter(Boolean)[0] || "";
  if (host === "youtube.com" || host.endsWith(".youtube.com")) return url.searchParams.get("v") || "";
  return "";
}

async function preview(source) {
  const submitted = await assertPublicHttps(source.url);
  const videoId = youtubeId(submitted);
  if (videoId) {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`;
    const response = await fetch(oembedUrl, { headers: { Accept: "application/json", "User-Agent": "WorldLeaderChat/1.0 source preview" } });
    if (!response.ok) throw new Error(`YouTube metadata returned HTTP ${response.status}.`);
    const data = await response.json();
    return {
      source: { ...source, label: String(data.title || source.label).slice(0, 300), publisher: `${data.author_name || "YouTube"} (YouTube)`.slice(0, 120) },
      digest: String(data.title || source.label).slice(0, 1200)
    };
  }

  const { url, html } = await publicFetch(submitted.href);
  const title = meta(html, ["og:title", "twitter:title"]) || decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
  const description = meta(html, ["description", "og:description", "twitter:description"]);
  const siteName = meta(html, ["og:site_name"]);
  return {
    source: { ...source, label: (title || source.label).slice(0, 300), publisher: (siteName || publisherFromHost(url.hostname)).slice(0, 120) },
    digest: (description || title || source.label).slice(0, 1200)
  };
}

function replaceBundle(body, bundle) {
  const start = body.indexOf(STORY_JSON_START);
  const end = body.indexOf(STORY_JSON_END);
  if (start < 0 || end <= start) throw new Error("Issue is missing editorial JSON markers.");
  const block = `${STORY_JSON_START}\n\`\`\`json\n${JSON.stringify(bundle, null, 2)}\n\`\`\`\n${STORY_JSON_END}`;
  return body.slice(0, start) + block + body.slice(end + STORY_JSON_END.length);
}

const issue = await github(`/repos/${repository}/issues/${issueNumber}`);
const bundle = extractStoryBundle(issue.body || "");
if (!bundle.ingestion?.customSubmission) {
  console.log(`Issue #${issueNumber} is not a custom submission; source enrichment skipped.`);
  process.exit(0);
}

const previews = [];
for (const source of (bundle.event.sources || []).slice(0, 5)) {
  await assertPublicHttps(source.url);
  try {
    previews.push(await preview(source));
  } catch (error) {
    console.warn(`Metadata preview unavailable for ${source.url}: ${error.message}`);
    previews.push({ source, digest: source.label });
  }
}
bundle.event.sources = previews.map((item) => item.source);
bundle.ingestion.coveragePublishers = bundle.event.sources.map((source) => source.publisher);
const editorNotes = (bundle.ingestion.sourceDigests || []).filter((item) => item.publisher === "Editor submission notes");
bundle.ingestion.sourceDigests = [...editorNotes, ...previews.map((item) => ({ publisher: item.source.publisher, excerpt: item.digest }))];

await github(`/repos/${repository}/issues/${issueNumber}`, {
  method: "PATCH",
  body: JSON.stringify({ body: replaceBundle(issue.body, bundle) })
});
console.log(`Enriched ${previews.length} public source link(s) for custom issue #${issueNumber}.`);
