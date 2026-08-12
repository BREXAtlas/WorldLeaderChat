import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("one shared eight-desk taxonomy drives category color and newsroom search", async () => {
  const source = await read("newsroom-taxonomy.js");
  const context = vm.createContext({});
  vm.runInContext(source, context);
  const newsroom = context.WLC_NEWSROOM;
  assert.equal(newsroom.desks.length, 8);
  assert.equal(Object.keys(newsroom.colors).length, 8);
  assert.equal(new Set(Object.values(newsroom.colors)).size, 8);

  const event = {
    title: "Emergency summit opens",
    article: { headline: "LEADERS MEET", body: ["A regional crisis prompted an emergency summit."] },
    messages: [{ speaker: "President Amara", text: "The evacuation corridor must remain open." }],
    sources: [{ publisher: "Reuters", label: "Summit coverage" }]
  };
  assert.equal(newsroom.matchesSearch(event, "crisis"), true);
  assert.equal(newsroom.matchesSearch(event, "President Amara"), true);
  assert.equal(newsroom.matchesSearch(event, "Reuters"), true);
  assert.equal(newsroom.matchesSearch(event, "football"), false);
});

test("homepage uses featured selection, category colors, sidebar sponsors and requested footer", async () => {
  const html = await read("index.html");
  const rolling = await read("rolling-archive.js");
  const experience = await read("newsroom-experience.js");
  assert.match(experience, /function featuredEvents/);
  assert.match(experience, /FEATURED ACROSS THE NEWSROOM/);
  assert.match(experience, /candidates\.find\(\(event\) => event\.featured\) \|\| candidates\[0\]/);
  assert.match(html, /globalThis\.WLC_NEWSROOM\.matchesSearch/);
  assert.match(rolling, /data-desk="War & Security"[\s\S]*#a30d16/);
  assert.match(rolling, /data-desk="Culture & Entertainment"[\s\S]*#9b175c/);
  assert.match(html, /Search a crisis, event, leader or source/);
  assert.match(html, /HOW TO READ THE LEAK[\s\S]*\$\{sponsorHTML\(\)\}/);
  assert.match(html, /It’s your semester, own it\./);
  assert.match(html, /mailto:hello@transformontologysystems\.com/);
  assert.match(html, /Powered by TOS/);
  assert.match(html, /© 2026 World Leaders Chat/);
});

test("public controls have no unexplained meme/fact mode or verbose exporter disclaimer", async () => {
  const html = await read("index.html");
  const exporter = await read("social-card-export.js");
  assert.doesNotMatch(html, /id="modeBtn"|id="modeNote"|Meme Mode|Fact Mode/);
  assert.doesNotMatch(exporter, /Branded background, headline, chat excerpt/);
  assert.doesNotMatch(exporter, /Carousel ZIPs contain the complete chat/);
});

test("editor has a wide active lane, daily mix tools, publishing status and a desk-carousel feature action", async () => {
  const html = await read("editor/index.html");
  const app = await read("editor/app.js");
  assert.match(html, /\.lane\.show\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(html, /id="editorSearch"/);
  assert.match(html, /id="editorDesk"/);
  assert.match(html, /id="editorDate"/);
  assert.match(html, /Today’s editorial mix/);
  assert.match(html, /8:00 AM • 12:00 PM • 4:00 PM • 8:00 PM Central/);
  assert.match(app, /Feature in \$\{esc\(cardDesk\)\} Carousel/);
  assert.match(app, /\['featured-headline'\]/);
  assert.match(app, /WLC_NEWSROOM\?\.matchesSearch/);
  assert.match(app, /reviewCount} to review • \$\{publishingCount} publishing • \$\{publishedCount} published/);
  assert.match(app, /\['publishing','Publishing'\]/);
  assert.match(app, /busy\.has\(issue\.number\) \|\| labels\.has\('editorial-approved'\)[\s\S]*return 'publishing'/);
  assert.match(app, /busy\.add\(number\);[\s\S]*activeLane = 'publishing';[\s\S]*render\(\)/);
  assert.match(app, /\['trash','🗑 Trash'\]/);
  assert.match(app, /labels\.has\('rejected'\)[\s\S]*return 'trash'/);
  assert.match(app, /async function rejectIssue\(number\)[\s\S]*replaceLocalIssue\(number, rejected\);[\s\S]*render\(\);[\s\S]*Saving the rejection/);
  assert.match(app, /deskOf\(issue\) === desk && laneOf\(issue\) !== 'trash'/);
  assert.match(app, /\['new','drafting','ready'\]\.includes\(laneOf\(issue\)\)/);
  assert.match(app, /Restore to Review/);
  assert.match(app, /Permanently Delete File/);
  assert.match(html, /READY FOR APPROVAL → PUBLISHING → PUBLISHED • REJECTIONS → TRASH/);
  assert.match(html, /\.tag\.publishing\{/);
  assert.match(html, /\.tag\.trash\{/);
});

test("featured-headline workflow persists one selected article per news desk", async () => {
  const workflow = await read(".github/workflows/featured-story.yml");
  const selector = await read("scripts/set-featured-story.mjs");
  assert.match(workflow, /github\.event\.label\.name == 'featured-headline'/);
  assert.match(workflow, /github\.event\.label\.name == 'featured-headline'[\s\S]*'world-leader-chat-main-writes' \|\| github\.run_id/);
  assert.match(workflow, /queue: max/);
  assert.match(workflow, /node scripts\/set-featured-story\.mjs/);
  assert.match(selector, /event\.featured = true/);
  assert.match(selector, /deskFor\(event\) === selectedDesk/);
  assert.match(selector, /replaced_issue_numbers/);
  assert.match(workflow, /Other desk selections remain in place/);
  assert.match(selector, /editorial\?\.issueNumber/);
});

test("automated drafting cannot replace the canonical ingestion desk", async () => {
  const draft = await read("scripts/draft-editorial-issues-v2.mjs");
  const editorial = await read("scripts/lib/editorial.mjs");
  assert.match(draft, /Keep category exactly/);
  assert.match(draft, /result\.ingestion\?\.newsroomDesk \|\| result\.event\.category/);
  assert.doesNotMatch(draft, /result\.event\.category = cleanWhitespace\(output\.category/);
  assert.match(editorial, /category: candidate\.newsroomDesk \|\| candidate\.category/);
});

test("public and social article links use the custom domain", async () => {
  const html = await read("index.html");
  const social = await read("social-tools.js");
  const exporter = await read("social-card-export.js");
  const build = await read("scripts/build-site.mjs");
  assert.match(html, /rel="canonical" href="https:\/\/worldleaders\.chat\/"/);
  assert.match(social, /https:\/\/worldleaders\.chat\/#event=/);
  assert.match(exporter, /const SOCIAL_IMAGE_URL = "worldleaders\.chat"/);
  assert.doesNotMatch(exporter, /#event=/);
  assert.match(build, /writeFile\(resolve\(output, "CNAME"\), "worldleaders\.chat\\n"/);
  assert.match(build, /const \{ issueUrl, approvedBy, fingerprint, \.\.\.publicEditorial \}/);
  assert.doesNotMatch(`${html}\n${social}\n${exporter}`, /brexatlas\.github\.io/i);
});
