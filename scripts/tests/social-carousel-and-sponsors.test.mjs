import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

class MockContext {
  constructor() {
    this.font = "16px Arial";
    this.texts = [];
    this.images = [];
  }

  measureText(value) {
    const size = Number(this.font.match(/(\d+(?:\.\d+)?)px/)?.[1] || 16);
    return { width: String(value).length * size * 0.53 };
  }

  fillText(text, x, y) { this.texts.push({ text: String(text), x, y }); }
  drawImage(...args) { this.images.push(args); }
  beginPath() {}
  moveTo() {}
  lineTo() {}
  quadraticCurveTo() {}
  closePath() {}
  fill() {}
  stroke() {}
  fillRect() {}
  save() {}
  restore() {}
}

class MockCanvas {
  constructor() {
    this.width = 0;
    this.height = 0;
    this.context = new MockContext();
  }

  getContext() { return this.context; }
  toBlob(callback) { callback(new Blob(["mock png"], { type: "image/png" })); }
}

class MockFile extends Blob {
  constructor(parts, name, options) {
    super(parts, options);
    this.name = name;
  }
}

function installExporter(navigatorValue = {}) {
  const downloads = [];
  class MockImage {
    constructor() {
      this.naturalWidth = 900;
      this.naturalHeight = 260;
    }

    set src(value) {
      this.currentSrc = value;
      queueMicrotask(() => this.onload?.());
    }
  }

  const document = {
    readyState: "loading",
    fonts: { ready: Promise.resolve() },
    body: { appendChild() {} },
    addEventListener() {},
    createElement(tag) {
      if (tag === "canvas") return new MockCanvas();
      if (tag === "a") {
        return {
          download: "",
          href: "",
          click() { downloads.push(this.download); },
          remove() {}
        };
      }
      return {
        style: {},
        setAttribute() {},
        append() {},
        appendChild() {},
        addEventListener() {},
        remove() {}
      };
    },
    getElementById() { return null; },
    querySelector() { return null; }
  };
  const context = vm.createContext({
    Blob,
    File: MockFile,
    Image: MockImage,
    TextEncoder,
    URL,
    console,
    document,
    location: {
      href: "https://brexatlas.github.io/WorldLeaderChat/",
      origin: "https://brexatlas.github.io",
      pathname: "/WorldLeaderChat/",
      host: "brexatlas.github.io",
      hash: ""
    },
    navigator: navigatorValue,
    queueMicrotask,
    setTimeout(callback) { callback(); return 1; },
    window: {}
  });
  return read("social-card-export.js").then((source) => {
    vm.runInContext(source, context);
    return { api: context.window.WLC_SOCIAL_EXPORT, downloads };
  });
}

function fixtureEvent(messageCount = 36) {
  return {
    id: "future-article-fixture",
    date: "August 10, 2026",
    category: "World News",
    title: "A FULL EVENT HEADLINE THAT MUST SURVIVE EVERY SOCIAL EXPORT",
    article: {
      headline: "A Full Article Headline That Must Survive Every Social Export",
      dek: "A short sourced summary introduces the complete conversation without requiring story-specific artwork."
    },
    messages: Array.from({ length: messageCount }, (_, index) => ({
      speaker: index % 7 === 0 ? "UN Admin" : `Leader ${index + 1}`,
      kind: index % 7 === 0 ? "system" : index % 5 === 0 ? "public" : "satire",
      text: `Message ${index + 1} remains in the generated carousel, including enough words to exercise clean browser-side pagination.`,
      reaction: index % 6 === 0 ? `Reaction ${index + 1} also remains attached.` : ""
    })),
    meme: "THE LAST WORD REMAINS WHERE THE FOOTER CANNOT REACH IT.",
    sources: [
      { publisher: "Reuters", url: "https://example.com/reuters" },
      { publisher: "Associated Press", url: "https://example.com/ap" }
    ]
  };
}

test("single PNG and all four social export controls remain in article actions", async () => {
  const source = await read("social-card-export.js");
  assert.match(source, /Save Social PNG/);
  assert.match(source, /Share Social PNG/);
  assert.match(source, /Save Social Carousel/);
  assert.match(source, /Share Social Carousel/);
  assert.match(source, /document\.querySelector\("\.detail-actions"\)/);
  assert.match(source, /Social format/);
});

test("feed, story/TikTok and X presets render their required dimensions", async () => {
  const { api } = await installExporter();
  const event = fixtureEvent(8);
  const expected = {
    feed: [1080, 1350],
    story: [1080, 1920],
    landscape: [1600, 900]
  };
  for (const [format, dimensions] of Object.entries(expected)) {
    const canvas = await api.renderSocialCanvas(event, format);
    assert.deepEqual([canvas.width, canvas.height], dimensions);
  }
});

test("the complete chat, including chat notes and reactions, is split without discarded lines", async () => {
  const { api } = await installExporter();
  const event = fixtureEvent();
  const plan = api.createCarouselPlan(event, "feed");
  const messageIndexes = new Set(plan.pages.flatMap((page) => page.fragments.map((fragment) => fragment.messageIndex)));
  assert.ok(plan.pages.length > 2);
  assert.equal(plan.renderedLineCount, plan.sourceLineCount);
  assert.equal(messageIndexes.size, event.messages.length);
  assert.ok(plan.pages.at(-1).fragments.length > 0);
});

test("every rendered slide has the existing logo and PAGE X / Y numbering", async () => {
  const { api } = await installExporter();
  const canvases = await api.renderSocialCarousel(fixtureEvent(), "feed");
  assert.ok(canvases.length > 2);
  canvases.forEach((canvas, index) => {
    assert.ok(canvas.context.images.length >= 2, `slide ${index + 1} should draw the watermark and masthead logo`);
    assert.ok(canvas.context.texts.some(({ text }) => text === `PAGE ${index + 1} / ${canvases.length}`));
  });
});

test("the final slide includes Last Word, source publishers, article URL and disclosure", async () => {
  const { api } = await installExporter();
  const canvases = await api.renderSocialCarousel(fixtureEvent(), "story");
  const text = canvases.at(-1).context.texts.map((entry) => entry.text).join("\n");
  assert.match(text, /LAST WORD/);
  assert.match(text, /THE LAST WORD REMAINS/);
  assert.match(text, /SOURCE PUBLISHERS/);
  assert.match(text, /Reuters.*Associated Press/);
  assert.match(text, /#event=future-article-fixture/);
  assert.match(text, /REAL EVENT • ORIGINAL SOURCES • IMAGINED REACTIONS/);
});

test("single-image overflow, Last Word and footer occupy ordered non-overlapping zones", async () => {
  const { api } = await installExporter();
  const canvas = await api.renderSocialCanvas(fixtureEvent(), "feed");
  const overflow = canvas.context.texts.find(({ text }) => text.includes("MORE MESSAGES IN THE FULL FILE"));
  const lastWord = canvas.context.texts.find(({ text }) => text.startsWith("LAST WORD:"));
  const footer = canvas.context.texts.find(({ text }) => text === "REAL EVENT • ORIGINAL SOURCES • IMAGINED REACTIONS");
  assert.ok(overflow && lastWord && footer);
  assert.ok(overflow.y < lastWord.y, "overflow notice should be above Last Word");
  assert.ok(lastWord.y < footer.y, "Last Word should be above the source footer");
});

test("native multi-file sharing uses canShare and passes every numbered PNG", async () => {
  let sharedData;
  let checkedFiles;
  const navigatorValue = {
    canShare(data) { checkedFiles = data.files; return true; },
    async share(data) { sharedData = data; }
  };
  const { api } = await installExporter(navigatorValue);
  const result = await api.shareSocialCarousel(fixtureEvent(), "landscape");
  assert.equal(result.shared, true);
  assert.ok(checkedFiles.length > 1);
  assert.equal(sharedData.files.length, checkedFiles.length);
  assert.match(sharedData.files[0].name, /-01-of-\d{2}\.png$/);
  assert.match(sharedData.files.at(-1).name, /-\d{2}-of-\d{2}\.png$/);
});

test("unsupported multi-file sharing downloads one ZIP containing sorted PNG names", async () => {
  const { api, downloads } = await installExporter({});
  const result = await api.shareSocialCarousel(fixtureEvent(10), "feed");
  assert.equal(result.shared, false);
  assert.ok(result.files.length > 1);
  assert.match(result.files[0].name, /-01-of-\d{2}\.png$/);
  assert.match(downloads.at(-1), /-feed-carousel\.zip$/);
});

test("sponsors follow newsroom content with exact EdNotebook copy and live-site destinations", async () => {
  const html = await read("index.html");
  const archiveIndex = html.indexOf('<main class="archive"');
  const sponsorsIndex = html.indexOf('<section class="sponsors"');
  const sponsorBlock = html.slice(sponsorsIndex, html.indexOf("</section>", sponsorsIndex) + 10);
  assert.ok(sponsorsIndex > archiveIndex);
  assert.match(sponsorBlock, /FROM OUR SPONSORS/);
  assert.match(sponsorBlock, /It’s your semester, own it\./);
  assert.match(sponsorBlock, /href="https:\/\/ednotebook\.com"/);
  assert.match(sponsorBlock, /href="https:\/\/outbreak-atlas-cyclospora\.magazinebeaucoup\.chatgpt\.site\/"/);
  assert.doesNotMatch(sponsorBlock, /github\.com|repositor(?:y|ies)/i);
});

test("Pages packages and smoke-checks carousel code, sponsors and both public URLs", async () => {
  const build = await read("scripts/build-site.mjs");
  const workflow = await read(".github/workflows/deploy-pages.yml");
  assert.match(build, /social-card-export\.js\?v=20260810-carousel/);
  assert.match(build, /cp\(resolve\(root, "social-card-export\.js"\)/);
  assert.match(workflow, /Save Social Carousel/);
  assert.match(workflow, /Share Social Carousel/);
  assert.match(workflow, /PAGE \$\{pageNumber\} \/ \$\{pageCount\}/);
  assert.match(workflow, /FROM OUR SPONSORS/);
  assert.match(workflow, /https:\/\/ednotebook\.com/);
  assert.match(workflow, /https:\/\/outbreak-atlas-cyclospora\.magazinebeaucoup\.chatgpt\.site\//);
});

test("existing article/chat copy and social-copy controls are preserved", async () => {
  const social = await read("social-tools.js");
  assert.match(social, /Copy Article \+ Chat/);
  assert.match(social, /Copy Social Version/);
  assert.match(social, /transcriptText\(event\)/);
  assert.match(social, /socialText\(event\)/);
});
