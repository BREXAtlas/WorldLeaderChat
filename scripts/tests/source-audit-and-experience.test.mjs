import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("source audit exposes a transparent signed scale and distinguishes balanced neutral sourcing", async () => {
  const context = vm.createContext({});
  vm.runInContext(await read("source-audit.js"), context);
  const audit = context.WLC_SOURCE_AUDIT;

  assert.equal(audit.scale.length, 4);
  assert.equal(audit.designation(-13).label, "Neutral");
  assert.equal(audit.designation(-31).label, "Left-leaning");
  assert.equal(audit.designation(78).label, "Strong Right");

  const reuters = audit.profileFor("Reuters");
  assert.equal(reuters.score, -13);
  assert.equal(reuters.confidence, "high");
  assert.equal(audit.designation(audit.profileFor("Fox News Digital").score).label, "Right");
  assert.equal(audit.designation(audit.profileFor("National Review").score).label, "Right");
  assert.equal(audit.designation(audit.profileFor("The Dispatch").score).label, "Right-leaning");

  const balanced = audit.auditEvent({
    sources: [
      { publisher: "Left Example", audit: { score: -60, confidence: "high" } },
      { publisher: "Right Example", audit: { score: 60, confidence: "high" } }
    ]
  });
  assert.equal(balanced.label, "Neutral");
  assert.equal(balanced.score, 0);
  assert.match(balanced.basis, /left- and right-oriented sources balance/);
});

test("source audit makes every article searchable by publisher and source orientation", async () => {
  const context = vm.createContext({});
  vm.runInContext(await read("source-audit.js"), context);
  vm.runInContext(await read("newsroom-taxonomy.js"), context);
  const event = {
    title: "Policy briefing",
    sources: [{ publisher: "The Atlantic", label: "Policy report" }]
  };
  assert.equal(context.WLC_NEWSROOM.matchesSearch(event, "Atlantic"), true);
  assert.equal(context.WLC_NEWSROOM.matchesSearch(event, "strong left"), true);
  assert.equal(context.WLC_NEWSROOM.matchesSearch(event, "source audit"), true);
});

test("event clustering joins same-event coverage without grouping broad-topic neighbors", async () => {
  const context = vm.createContext({
    WLC_NEWSROOM: {
      desks: ["Technology & AI"],
      sectionFor: () => "Technology & AI"
    }
  });
  vm.runInContext(await read("newsroom-experience.js"), context);
  const experience = context.WLC_NEWSROOM_EXPERIENCE;
  const older = {
    id: "anthropic-verge",
    eventDate: "2026-08-10",
    title: "Anthropic adds invisible watermarks to Claude text and images",
    kicker: "European transparency rules prompt machine-readable provenance",
    sources: [{ publisher: "The Verge", url: "https://example.com/verge" }]
  };
  const newer = {
    id: "anthropic-reuters",
    eventDate: "2026-08-11",
    title: "Claude will apply invisible watermarks to AI text and images",
    kicker: "Anthropic responds to European transparency rules with provenance metadata",
    sources: [{ publisher: "Reuters", url: "https://example.com/reuters" }],
    editorial: { issueNumber: 2 }
  };
  const separate = {
    id: "chatgpt-study-mode",
    eventDate: "2026-08-11",
    title: "OpenAI launches a new ChatGPT study mode for college students",
    kicker: "The education feature changes how answers are presented",
    sources: [{ publisher: "TechCrunch", url: "https://example.com/techcrunch" }],
    editorial: { issueNumber: 1 }
  };

  assert.equal(experience.sameEvent(older, newer), true);
  assert.equal(experience.sameEvent(newer, separate), false);
  assert.deepEqual([...experience.relatedEvents(newer, [older, newer, separate])].map((event) => event.id), ["anthropic-verge"]);
  assert.deepEqual([...experience.collapseRelated([older, newer, separate])].map((event) => event.id), ["anthropic-reuters", "chatgpt-study-mode"]);
});

test("compact cards use a word limit, ticker is capped, and featured selection fills desk slots", async () => {
  const context = vm.createContext({
    WLC_NEWSROOM: {
      desks: ["Technology & AI", "World News"],
      sectionFor: (event) => event.category
    }
  });
  vm.runInContext(await read("newsroom-experience.js"), context);
  const experience = context.WLC_NEWSROOM_EXPERIENCE;
  const longEvent = {
    id: "long",
    eventDate: "2026-08-11",
    date: "August 11, 2026",
    category: "Technology & AI",
    title: "Long article",
    kicker: "A concise deck remains visible.",
    summary: Array.from({ length: 80 }, (_, index) => `word${index}`).join(" "),
    meme: "Last word",
    sources: []
  };
  assert.match(experience.compactStoryHTML(longEvent), /class="story-drawer"/);
  assert.match(experience.compactStoryHTML(longEvent), /OPEN FULL FILE \+ CHAT/);

  const events = Array.from({ length: 15 }, (_, index) => ({
    ...longEvent,
    id: `event-${index}`,
    title: `Topic${index} receives update${index}`,
    kicker: `Development${index} concerns subject${index} and actor${index}.`,
    eventDate: `2026-08-${String(11 - Math.floor(index / 3)).padStart(2, "0")}`,
    category: index % 2 ? "World News" : "Technology & AI",
    editorial: { issueNumber: index + 1 }
  }));
  assert.equal(experience.tickerEvents(events).length, 12);
  assert.equal(experience.featuredEvents(events).length, 2);
});

test("Pages build packages the audit and newsroom experience modules", async () => {
  const build = await read("scripts/build-site.mjs");
  const deploy = await read(".github/workflows/deploy-pages.yml");
  assert.match(build, /source-audit\.js\?v=20260811-balanced-sources/);
  assert.match(build, /newsroom-experience\.js\?v=20260811-newsroom-experience/);
  assert.match(build, /cp\(resolve\(root, "source-audit\.js"\)/);
  assert.match(build, /cp\(resolve\(root, "newsroom-experience\.js"\)/);
  assert.match(build, /data\/source-pool\.json/);
  assert.match(await read("source-audit.js"), /MONITORED PARTISAN POOL/);
  assert.match(deploy, /HOW THE PERCENTAGES WORK/);
  assert.match(deploy, /CHECK OUT THESE RELATED ARTICLES/);
});
