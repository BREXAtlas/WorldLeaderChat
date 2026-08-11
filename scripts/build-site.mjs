import { execFileSync } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { readJson } from "./lib/io.mjs";

const root = process.cwd();
const output = resolve(root, "_site");
execFileSync(process.execPath, [resolve(root, "scripts/validate-repository.mjs")], { stdio: "inherit" });

await rm(output, { recursive: true, force: true });
await mkdir(resolve(output, "data"), { recursive: true });
await mkdir(resolve(output, "editor"), { recursive: true });
await mkdir(resolve(output, "assets"), { recursive: true });

const publicHtml = await readFile(resolve(root, "index.html"), "utf8");
const publicScripts = [
  '  <script src="./social-tools.js"></script>',
  '  <script src="./social-card-export.js?v=20260810-carousel"></script>',
  '  <script src="./newsroom-site.js"></script>',
  '  <script src="./disclosure-polish.js"></script>',
  '  <script src="./recency-order.js?v=20260810"></script>',
  '  <script src="./rolling-archive.js?v=monthly-20260810"></script>'
];
const brandMarkup = '<img class="brand-logo" src="./assets/world-leaders-chat-logo.webp" alt="World Leaders Chat — News. Analysis. Satire.">';
const brandStyles = `
<style id="world-leader-chat-brand">
.brand-logo{display:block;width:min(390px,82vw);height:auto;margin:0 auto 8px;object-fit:contain}
@media (max-width:800px){.brand-logo{width:min(330px,88vw);margin-top:2px}}
</style>`;
const faviconLinks = '<link rel="icon" type="image/webp" href="./assets/world-leaders-chat-favicon.webp"><link rel="shortcut icon" href="./assets/world-leaders-chat-favicon.webp">';

let instrumentedHtml = publicHtml
  .replace(
    /<div class="satire-strip">[\s\S]*?<\/div>/,
    '<div class="satire-strip"><b>WORLD LEADER CHAT</b> • REAL EVENTS • ORIGINAL SOURCES • IMAGINED PRIVATE REACTIONS</div>'
  )
  .replace(
    /<div class="eyebrow">THE LEAK THAT NEVER HAPPENED<\/div>\s*<h1>WORLD LEADER CHAT<\/h1>/,
    brandMarkup
  )
  .replace(
    /<p class="mast-note">[\s\S]*?<\/p>/,
    '<p class="mast-note">The day’s real headlines, rewritten with a sharper edge. Open any file for the short report, the original sources and the conversation the room might have sounded like.</p>'
  )
  .replace(
    /<button class="btn" id="modeBtn" type="button">[\s\S]*?<\/button>/,
    '<button class="btn" id="modeBtn" type="button">Switch to Report Mode</button>'
  )
  .replace(
    /<div class="mode-note" id="modeNote">[\s\S]*?<\/div>/,
    '<div class="mode-note" id="modeNote">HEADLINE MODE: scan the sharpest line, then open any file for the report, sources and conversation.</div>'
  )
  .replace(
    /<b>WORLD LEADER CHAT \/\/ FICTIONAL TRANSCRIPT VIEWER<\/b>/,
    '<b>WORLD LEADER CHAT // THE FILE</b>'
  )
  .replace(
    /<p>End-to-end fictional • public record excerpts highlighted in yellow<\/p>/,
    '<p>Sourced event • imagined off-mic reactions • public-record excerpts highlighted in yellow</p>'
  )
  .replace(
    /<footer>[\s\S]*?<\/footer>/,
    '<footer><strong>POLITICAL PARODY, NOT LEAKED CORRESPONDENCE.</strong><br>No private message on this page is authentic. Public-record excerpts are brief, visibly labeled and paired with source links.</footer>'
  )
  .replace(
    "</head>",
    `${faviconLinks}\n${brandStyles}\n<style id="newsroom-critical">#deskJump,.update-desk{display:none!important}</style>\n</head>`
  );

for (const tag of publicScripts) {
  const src = tag.match(/src="([^"]+)/)?.[1];
  const pathOnly = src?.split("?")[0];
  if (pathOnly && !instrumentedHtml.includes(pathOnly)) instrumentedHtml = instrumentedHtml.replace("</body>", `${tag}\n</body>`);
}
await writeFile(resolve(output, "index.html"), instrumentedHtml, "utf8");
await writeFile(resolve(output, "404.html"), instrumentedHtml, "utf8");
await cp(resolve(root, "social-tools.js"), resolve(output, "social-tools.js"));
await cp(resolve(root, "social-card-export.js"), resolve(output, "social-card-export.js"));
await cp(resolve(root, "newsroom-site.js"), resolve(output, "newsroom-site.js"));
await cp(resolve(root, "disclosure-polish.js"), resolve(output, "disclosure-polish.js"));
await cp(resolve(root, "recency-order.js"), resolve(output, "recency-order.js"));
await cp(resolve(root, "rolling-archive.js"), resolve(output, "rolling-archive.js"));
await cp(resolve(root, "editor/index.html"), resolve(output, "editor/index.html"));
await cp(resolve(root, "editor/app.js"), resolve(output, "editor/app.js"));
await cp(resolve(root, "editor/published-data.js"), resolve(output, "editor/published-data.js"));
await cp(resolve(root, "editor/conversation-upgrade.js"), resolve(output, "editor/conversation-upgrade.js"));
await cp(resolve(root, "editor/newsroom-upgrade.js"), resolve(output, "editor/newsroom-upgrade.js"));
await cp(resolve(root, "assets/world-leaders-chat-logo.webp"), resolve(output, "assets/world-leaders-chat-logo.webp"));
await cp(resolve(root, "assets/world-leaders-chat-favicon.webp"), resolve(output, "assets/world-leaders-chat-favicon.webp"));
await cp(resolve(root, "data/published-events.json"), resolve(output, "data/published-events.json"));

const published = await readJson(resolve(root, "data/published-events.json"), []);
const siteMeta = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  publishedEventCount: published.length,
  latestEventDate: published[0]?.eventDate ?? null
};
await writeFile(resolve(output, "data/site-meta.json"), `${JSON.stringify(siteMeta, null, 2)}\n`, "utf8");
await writeFile(resolve(output, ".nojekyll"), "", "utf8");
await writeFile(resolve(output, "robots.txt"), "User-agent: *\nAllow: /\nDisallow: /editor/\n", "utf8");

const htmlSize = (await readFile(resolve(output, "index.html"))).byteLength;
const socialSize = (await readFile(resolve(output, "social-tools.js"))).byteLength;
const socialCardSize = (await readFile(resolve(output, "social-card-export.js"))).byteLength;
const newsroomSize = (await readFile(resolve(output, "newsroom-site.js"))).byteLength;
const disclosureSize = (await readFile(resolve(output, "disclosure-polish.js"))).byteLength;
const recencySize = (await readFile(resolve(output, "recency-order.js"))).byteLength;
const rollingSize = (await readFile(resolve(output, "rolling-archive.js"))).byteLength;
const editorSize = (await readFile(resolve(output, "editor/index.html"))).byteLength;
const appSize = (await readFile(resolve(output, "editor/app.js"))).byteLength;
const publishedDataSize = (await readFile(resolve(output, "editor/published-data.js"))).byteLength;
const conversationSize = (await readFile(resolve(output, "editor/conversation-upgrade.js"))).byteLength;
const editorNewsroomSize = (await readFile(resolve(output, "editor/newsroom-upgrade.js"))).byteLength;
const logoSize = (await readFile(resolve(output, "assets/world-leaders-chat-logo.webp"))).byteLength;
const faviconSize = (await readFile(resolve(output, "assets/world-leaders-chat-favicon.webp"))).byteLength;
console.log(`Built GitHub Pages artifact in _site (${htmlSize} byte index, ${socialSize} byte social copy tools, ${socialCardSize} byte social PNG exporter, ${newsroomSize} byte newsroom UI, ${disclosureSize} byte disclosure polish, ${recencySize} byte recency order, ${rollingSize} byte monthly archive, ${editorSize} byte editor, ${appSize} byte editor app, ${publishedDataSize} byte canonical published adapter, ${conversationSize} byte conversation standard, ${editorNewsroomSize} byte article presentation, ${logoSize} byte logo, ${faviconSize} byte favicon, ${published.length} external event(s)).`);
