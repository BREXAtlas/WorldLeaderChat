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

class MockElement {
  constructor(tagName, downloads) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.listeners = new Map();
    this.attributes = new Map();
    this.downloads = downloads;
    this.value = "";
    this.disabled = false;
    this.style = {};
    this.textContent = "";
  }

  append(...children) {
    children.forEach((child) => this.appendChild(child));
  }

  appendChild(child) {
    this.children.push(child);
    child.parentElement = this;
    return child;
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatch(type) {
    for (const listener of this.listeners.get(type) || []) listener({ type, target: this, currentTarget: this });
  }

  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  remove() {}

  click() {
    if (this.tagName === "A") this.downloads.push(this.download);
    this.dispatch("click");
  }

  findById(id) {
    if (this.id === id) return this;
    for (const child of this.children) {
      const match = child.findById?.(id);
      if (match) return match;
    }
    return null;
  }
}

function fixtureEvent() {
  return {
    id: "future-approved-event-fixture",
    date: "August 11, 2026",
    category: "World News",
    title: "A future approved article",
    article: { headline: "A future approved article", dek: "A sourced summary." },
    messages: [
      { speaker: "UN Admin", kind: "system", text: "The file opened.", reaction: "" },
      { speaker: "Leader", kind: "satire", text: "The selected format stays selected.", reaction: "" }
    ],
    meme: "THE FORMAT CHANGED. THE ARTICLE STAYED OPEN.",
    sources: [{ publisher: "Reuters", url: "https://example.com/story" }]
  };
}

async function installControlHarness() {
  const downloads = [];
  const actions = new MockElement("div", downloads);
  const head = new MockElement("head", downloads);
  const body = new MockElement("body", downloads);
  const event = fixtureEvent();

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
    readyState: "complete",
    fonts: { ready: Promise.resolve() },
    head,
    body,
    createElement(tag) {
      if (tag === "canvas") return new MockCanvas();
      return new MockElement(tag, downloads);
    },
    querySelector(selector) { return selector === ".detail-actions" ? actions : null; },
    getElementById(id) { return actions.findById(id); },
    addEventListener() {}
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
      href: "https://worldleaders.chat/#event=future-approved-event-fixture",
      origin: "https://worldleaders.chat",
      pathname: "/",
      host: "worldleaders.chat",
      hash: "#event=future-approved-event-fixture"
    },
    navigator: {},
    queueMicrotask,
    setTimeout(callback) { callback(); return 1; },
    state: { currentId: event.id },
    allEvents: () => [event],
    window: {}
  });
  vm.runInContext(await read("social-card-export.js"), context);
  return { actions, api: context.window.WLC_SOCIAL_EXPORT, downloads };
}

test("format interaction is not mistaken for a backdrop click or article navigation", async () => {
  const html = await read("index.html");
  const predicateSource = html.match(/function isDialogBackdropClick\(event\)\{[\s\S]*?\n  \}/)?.[0];
  assert.ok(predicateSource, "the dialog backdrop predicate should exist");
  const isDialogBackdropClick = vm.runInNewContext(`(${predicateSource})`);

  const dialog = {};
  const formatControl = {};
  const articleState = {
    currentId: "2020-pandemic-declared",
    hash: "#event=2020-pandemic-declared",
    open: true
  };
  const handleDialogClick = (event) => {
    if (isDialogBackdropClick(event)) {
      articleState.currentId = null;
      articleState.hash = "";
      articleState.open = false;
    }
  };

  handleDialogClick({ target: formatControl, currentTarget: dialog, clientX: -100, clientY: -100 });
  assert.deepEqual(articleState, {
    currentId: "2020-pandemic-declared",
    hash: "#event=2020-pandemic-declared",
    open: true
  });

  handleDialogClick({ target: dialog, currentTarget: dialog });
  assert.equal(articleState.open, false, "a real backdrop click should still close the article");
  assert.doesNotMatch(html.slice(html.indexOf('$("#storyDialog").addEventListener("click"'), html.indexOf('$("#prevBtn")')), /getBoundingClientRect|clientX|clientY/);
});

test("social format controls cannot submit a form and retain one format for all export actions", async () => {
  const [html, source] = await Promise.all([read("index.html"), read("social-card-export.js")]);
  const dialogMarkup = html.slice(html.indexOf('<dialog id="storyDialog"'), html.indexOf("</dialog>") + 9);
  assert.doesNotMatch(dialogMarkup, /<form\b/i);
  assert.match(source, /button\.type = "button"/);
  assert.equal((source.match(/\(event, selectedFormat\)/g) || []).length, 4);

  const { actions, api, downloads } = await installControlHarness();
  const format = actions.findById("socialPngFormat");
  assert.equal(format.tagName, "SELECT");
  assert.equal(api.selectedFormat(), "feed");

  format.value = "story";
  format.dispatch("change");
  assert.equal(api.selectedFormat(), "story");

  actions.findById("saveSocialPngBtn").click();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.ok(downloads.some((name) => /-story\.png$/.test(name)), "single export should use Story/TikTok");

  actions.findById("saveSocialCarouselBtn").click();
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.ok(downloads.some((name) => /-story-carousel\.zip$/.test(name)), "carousel export should retain Story/TikTok");
});
