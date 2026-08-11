"use strict";

(function installWorldLeaderChatSourceAudit(global) {
  const REVIEWED_ON = "August 11, 2026";
  const SCALE = Object.freeze([
    { min: 0, max: 14, label: "Neutral", description: "Centered, topic-limited, primary-source, or closely balanced sourcing." },
    { min: 15, max: 39, label: "Leaning", description: "A noticeable but moderate left or right sourcing orientation." },
    { min: 40, max: 69, label: "Left / Right", description: "A consistent left or right sourcing orientation." },
    { min: 70, max: 100, label: "Strong Left / Right", description: "A strong and consistently expressed sourcing orientation." }
  ]);

  const profiles = new Map([
    ["al jazeera", profile(-38, "low", "news", "Public multipartisan rating data places its online news in the Lean Left range.")],
    ["associated press", profile(-34, "medium", "news", "Public multipartisan rating data places AP U.S. political coverage in the Lean Left range.")],
    ["bbc news", profile(-13, "medium", "news", "Public multipartisan reviews currently place BBC online news in the Center range, near the left edge.")],
    ["bbc sky at night magazine", profile(0, "medium", "specialty", "Science specialty publication; no stable partisan orientation is applied to its astronomy reporting.")],
    ["bbc sport", profile(0, "medium", "specialty", "Sports specialty desk; no stable partisan orientation is applied to routine sports reporting.")],
    ["cbs sports", profile(0, "medium", "specialty", "Sports specialty outlet; no stable partisan orientation is applied to routine sports reporting.")],
    ["cnbc", profile(-20, "medium", "news", "Public multipartisan rating data places CNBC online news in the Lean Left range.")],
    ["cnn", profile(-33, "high", "news", "Public multipartisan rating data places CNN Digital in the Lean Left range.")],
    ["deadline", profile(0, "medium", "specialty", "Entertainment trade outlet; no stable partisan orientation is applied to routine industry reporting.")],
    ["defense news", profile(0, "medium", "specialty", "Defense trade publication; topic expertise is recorded separately from partisan orientation.")],
    ["dw", profile(-10, "medium", "news", "International public-service news source assessed as broadly centered with a slight leftward orientation.")],
    ["entertainment weekly", profile(0, "medium", "specialty", "Entertainment specialty outlet; no stable partisan orientation is applied to routine culture reporting.")],
    ["espn", profile(0, "medium", "specialty", "Sports specialty outlet; no stable partisan orientation is applied to routine sports reporting.")],
    ["fox news", profile(53, "medium", "news", "Public multipartisan rating data places Fox News Digital in the Right range.")],
    ["fox news digital", profile(53, "medium", "news", "Public multipartisan rating data places Fox News Digital in the Right range.")],
    ["military times", profile(0, "medium", "specialty", "Military community publication; topic focus is recorded separately from partisan orientation.")],
    ["nasa", profile(0, "high", "primary", "Primary scientific source. Its institutional statements are not treated as a partisan news-outlet rating.")],
    ["nasa jet propulsion laboratory", profile(0, "high", "primary", "Primary scientific source. Its institutional statements are not treated as a partisan news-outlet rating.")],
    ["newsnation", profile(4, "high", "news", "Public multipartisan rating data places NewsNation online written coverage in the Center range.")],
    ["new york post", profile(52, "medium", "news", "Public multipartisan rating data places New York Post news in the Right range.")],
    ["new york post news", profile(52, "medium", "news", "Public multipartisan rating data places New York Post news in the Right range.")],
    ["npr", profile(-31, "medium", "news", "Public multipartisan rating data places NPR online news in the Lean Left range.")],
    ["professor nez youtube", profile(0, "low", "individual", "Individual commentary source with insufficient cross-partisan review data; held at Neutral pending review.")],
    ["reuters", profile(-13, "high", "news", "Public blind-survey and editorial-review data places Reuters in the Center range with a slight leftward score.")],
    ["rolling stone", profile(-58, "medium", "news", "Public media-bias reviews generally place its political coverage in the Left range.")],
    ["techcrunch", profile(-8, "medium", "specialty", "Technology trade outlet; assessed as broadly centered for the reporting used here.")],
    ["the atlantic", profile(-78, "low", "news", "Public multipartisan rating data places The Atlantic in the Left range.")],
    ["the daily beast", profile(-68, "high", "news", "Public multipartisan rating data places The Daily Beast in the Left range.")],
    ["the guardian", profile(-55, "high", "news", "Public media-bias reviews place The Guardian in the Left range.")],
    ["the verge", profile(-12, "medium", "specialty", "Technology and culture outlet; assessed as broadly centered with a slight leftward orientation for the reporting used here.")],
    ["trump white house archives", profile(0, "high", "primary", "Primary first-party government archive. It is labeled Neutral for source-mix math, not as independent reporting.")],
    ["u s department of state", profile(0, "high", "primary", "Primary first-party government source. It is labeled Neutral for source-mix math, not as independent reporting.")],
    ["un news", profile(0, "high", "primary", "Primary institutional news source. Its statements are not treated as independent partisan reporting.")],
    ["unfccc", profile(0, "high", "primary", "Primary intergovernmental source. Its statements are not treated as independent partisan reporting.")],
    ["united nations", profile(0, "high", "primary", "Primary intergovernmental source. Its statements are not treated as independent partisan reporting.")],
    ["variety", profile(0, "medium", "specialty", "Entertainment trade outlet; no stable partisan orientation is applied to routine industry reporting.")],
    ["wall street journal", profile(5, "high", "news", "Public blind-survey and review data places Wall Street Journal news in the Center range.")],
    ["wall street journal news", profile(5, "high", "news", "Public blind-survey and review data places Wall Street Journal news in the Center range.")],
    ["wall street journal opinion", profile(38, "medium", "opinion", "Public media-bias reviews place Wall Street Journal opinion in the Lean Right range.")],
    ["washington examiner", profile(38, "high", "news", "Public multipartisan rating data places Washington Examiner in the Lean Right range.")],
    ["world health organization", profile(0, "high", "primary", "Primary intergovernmental health source. Its statements are not treated as independent partisan reporting.")]
  ]);

  function profile(score, confidence, kind, note) {
    return Object.freeze({ score, confidence, kind, note });
  }

  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[character]);
  }

  function clampScore(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(-100, Math.min(100, Math.round(number))) : 0;
  }

  function profileFor(sourceOrPublisher) {
    const source = typeof sourceOrPublisher === "object" && sourceOrPublisher ? sourceOrPublisher : null;
    const publisher = source ? source.publisher : sourceOrPublisher;
    const customScore = source?.audit?.score ?? source?.biasScore;
    if (Number.isFinite(Number(customScore))) {
      return {
        score: clampScore(customScore),
        confidence: source?.audit?.confidence || "editorial",
        kind: source?.audit?.kind || "news",
        note: source?.audit?.note || "Publisher-specific score supplied with this source record."
      };
    }
    return profiles.get(normalize(publisher)) || {
      score: 0,
      confidence: "low",
      kind: "unrated",
      note: "No stable cross-partisan review is on file. It remains Neutral pending editorial review."
    };
  }

  function designation(score) {
    const value = clampScore(score);
    const amount = Math.abs(value);
    const side = value < 0 ? "Left" : value > 0 ? "Right" : "Neither";
    let label = "Neutral";
    if (amount >= 70) label = `Strong ${side}`;
    else if (amount >= 40) label = side;
    else if (amount >= 15) label = `${side}-leaning`;
    return { score: value, amount, side, label, neutral: amount < 15 };
  }

  function auditEvent(event) {
    const unique = new Map();
    for (const source of event?.sources || []) {
      const key = normalize(source.publisher || source.url);
      if (key && !unique.has(key)) unique.set(key, { source, profile: profileFor(source) });
    }
    const entries = [...unique.values()];
    if (!entries.length) {
      return {
        score: 0, amount: 0, side: "Neither", label: "Neutral", neutral: true,
        confidence: "low", basis: "No source is attached; neutral pending review.", entries: []
      };
    }
    const score = Math.round(entries.reduce((sum, entry) => sum + entry.profile.score, 0) / entries.length);
    const result = designation(score);
    const left = entries.some((entry) => entry.profile.score <= -15);
    const right = entries.some((entry) => entry.profile.score >= 15);
    const onlyCentered = entries.every((entry) => Math.abs(entry.profile.score) < 15);
    const hasLow = entries.some((entry) => entry.profile.confidence === "low");
    const allHigh = entries.every((entry) => entry.profile.confidence === "high");
    let basis = `${entries.length} distinct source${entries.length === 1 ? "" : "s"} averaged.`;
    if (result.neutral && left && right) basis = "Neutral because left- and right-oriented sources balance in this file.";
    else if (result.neutral && onlyCentered) basis = "Neutral because all sources are centered, primary, or topic-limited.";
    else if (result.neutral) basis = "Neutral because the combined source mix falls inside the center band.";
    return { ...result, confidence: hasLow ? "low" : allHigh ? "high" : "medium", basis, entries };
  }

  function scoreText(result) {
    if (!result.amount) return "0% neutral";
    return `${result.amount}% ${result.side.toLowerCase()}`;
  }

  function badgeHTML(event, className = "") {
    const result = auditEvent(event);
    return `<span class="source-mix-badge ${esc(className)} is-${esc(result.side.toLowerCase())}" title="${esc(result.basis)}">SOURCE MIX: ${esc(result.label.toUpperCase())} • ${esc(scoreText(result).toUpperCase())}</span>`;
  }

  function sourceBadgeHTML(source) {
    const current = profileFor(source);
    const result = designation(current.score);
    const kind = current.kind === "primary" ? " • PRIMARY" : current.kind === "unrated" ? " • REVIEW PENDING" : "";
    return `<span class="source-rating is-${esc(result.side.toLowerCase())}" title="${esc(current.note)}">${esc(result.label.toUpperCase())} • ${esc(scoreText(result).toUpperCase())}${kind}</span>`;
  }

  function searchTermsFor(event) {
    const result = auditEvent(event);
    return [
      "source audit", "political orientation", "bias rating", result.label, result.side,
      scoreText(result), result.basis,
      ...result.entries.flatMap(({ source, profile: current }) => {
        const rated = designation(current.score);
        return [source.publisher, rated.label, rated.side, scoreText(rated), current.kind, current.note];
      })
    ].join(" ");
  }

  function collectSiteSources(events) {
    const used = new Map();
    for (const event of events || []) {
      const seen = new Set();
      for (const source of event?.sources || []) {
        const key = normalize(source.publisher || source.url);
        if (!key) continue;
        if (!used.has(key)) used.set(key, { publisher: source.publisher || "Unknown source", source, files: 0 });
        if (!seen.has(key)) used.get(key).files += 1;
        seen.add(key);
      }
    }
    return [...used.values()].sort((a, b) => a.publisher.localeCompare(b.publisher));
  }

  function auditButtonHTML() {
    return `<div class="side-tabs"><button type="button" id="sourceAuditButton" class="source-audit-tab">SOURCE AUDIT <span aria-hidden="true">ⓘ</span></button></div>`;
  }

  function sourceRowHTML(item) {
    const current = profileFor(item.source);
    const rated = designation(current.score);
    const searchable = normalize(`${item.publisher} ${rated.label} ${rated.side} ${current.kind} ${current.note}`);
    return `<article class="audit-source-row" data-audit-search="${esc(searchable)}">
      <div><h3>${esc(item.publisher)}</h3><p>${esc(current.note)}</p></div>
      <div class="audit-source-rating">${sourceBadgeHTML(item.source)}<span>${item.files} site file${item.files === 1 ? "" : "s"} • ${esc(current.confidence)} confidence</span></div>
    </article>`;
  }

  function ensureDialog() {
    if (!global.document) return null;
    let dialog = document.getElementById("sourceAuditDialog");
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.id = "sourceAuditDialog";
    dialog.className = "source-audit-dialog";
    dialog.setAttribute("aria-labelledby", "sourceAuditTitle");
    document.body.appendChild(dialog);
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    return dialog;
  }

  function renderDialog() {
    const dialog = ensureDialog();
    if (!dialog) return null;
    const events = typeof global.allEvents === "function" ? global.allEvents() : [];
    const sources = collectSiteSources(events);
    dialog.innerHTML = `<div class="source-audit-page">
      <header class="source-audit-head">
        <div><span>TRANSPARENCY DESK</span><h2 id="sourceAuditTitle">SOURCE AUDIT</h2><p>How World Leaders Chat describes the political orientation of the original sourcing behind each file.</p></div>
        <button type="button" class="source-audit-close" aria-label="Close Source Audit">CLOSE ×</button>
      </header>
      <section class="audit-summary">
        <div><b>−100</b><span>STRONG LEFT</span></div><div><b>0</b><span>NEUTRAL</span></div><div><b>+100</b><span>STRONG RIGHT</span></div>
      </section>
      <button type="button" class="audit-info-button" aria-expanded="false" aria-controls="auditMethod">ⓘ HOW THE PERCENTAGES WORK</button>
      <section id="auditMethod" class="audit-method" hidden>
        <h3>The WLC source-orientation scale</h3>
        <p>Each outlet receives a signed editorial score from −100 (strong left) through 0 (neutral) to +100 (strong right). The percentage shown on a file is the absolute distance from neutral—not a probability, trust score, factual-accuracy score or endorsement.</p>
        <div class="audit-scale">${SCALE.map((band) => `<div><b>${band.min}–${band.max}</b><span>${esc(band.label)}</span><p>${esc(band.description)}</p></div>`).join("")}</div>
        <p><b>How a file is calculated:</b> one score per distinct publisher is averaged. A neutral result can mean centered/primary sourcing, or a combination of left and right sources that balances near zero. Primary sources remain identified as first-party material. Unknown outlets are held at Neutral with low confidence until reviewed.</p>
        <p><b>How outlets are reviewed:</b> public multipartisan blind-survey and editorial-panel research is used when available, then checked against article-level language, story selection, sourcing patterns and the outlet’s reporting type. Ratings describe a general sourcing orientation, not the truth of a specific story. “Left” does not mean “Democratic Party,” and “Right” does not mean “Republican Party.”</p>
        <p>Registry last reviewed ${esc(REVIEWED_ON)}. Scores can be revised as an outlet changes or stronger review evidence becomes available.</p>
      </section>
      <div class="audit-list-head"><div><h3>SOURCES USED ON THIS SITE</h3><p>${sources.length} source designation${sources.length === 1 ? "" : "s"}, generated from the current archive.</p></div><label>FILTER SOURCES<input id="sourceAuditSearch" type="search" placeholder="Search outlet or designation"></label></div>
      <div id="sourceAuditList" class="audit-source-list">${sources.map(sourceRowHTML).join("") || '<p class="audit-empty">No sources are loaded yet.</p>'}</div>
    </div>`;
    dialog.querySelector(".source-audit-close").onclick = () => dialog.close();
    const info = dialog.querySelector(".audit-info-button");
    const method = dialog.querySelector("#auditMethod");
    info.onclick = () => {
      const expanded = info.getAttribute("aria-expanded") === "true";
      info.setAttribute("aria-expanded", String(!expanded));
      method.hidden = expanded;
    };
    const search = dialog.querySelector("#sourceAuditSearch");
    search.oninput = () => {
      const query = normalize(search.value);
      dialog.querySelectorAll("[data-audit-search]").forEach((row) => {
        row.hidden = Boolean(query && !row.dataset.auditSearch.includes(query));
      });
    };
    return dialog;
  }

  function open() {
    const dialog = renderDialog();
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    dialog.querySelector(".source-audit-close")?.focus();
  }

  function bind() {
    if (!global.document) return;
    const button = document.getElementById("sourceAuditButton");
    if (button) button.onclick = open;
  }

  function injectStyles() {
    if (!global.document || document.getElementById("source-audit-style")) return;
    const style = document.createElement("style");
    style.id = "source-audit-style";
    style.textContent = `
      .source-mix-badge,.source-rating{display:inline-flex;align-items:center;width:max-content;max-width:100%;border:1px solid #111;background:#f4f0e5;padding:4px 6px;font:900 9px/1.2 Arial,sans-serif;letter-spacing:.055em;text-transform:uppercase}
      .source-mix-badge{margin:7px 0 2px}.source-rating{margin:4px 0 8px}
      .source-mix-badge.is-left,.source-rating.is-left{border-left:5px solid #2d5f9a}.source-mix-badge.is-right,.source-rating.is-right{border-left:5px solid #a43c2d}.source-mix-badge.is-neither,.source-rating.is-neither{border-left:5px solid #5c665d}
      .audited-source{border-bottom:1px dotted #aaa;padding:4px 0}.audited-source>a{margin:0!important}
      .side-tabs{border-top:1px solid #777;border-bottom:1px solid #777;margin:12px 0;padding:8px 0}
      .source-audit-tab{width:100%;display:flex;justify-content:space-between;border:0;background:#111;color:#fff;padding:10px 12px;font:900 11px Arial,sans-serif;letter-spacing:.12em;cursor:pointer;text-align:left}
      .source-audit-tab:hover,.source-audit-tab:focus-visible{background:#c40000}
      dialog.source-audit-dialog{width:min(1080px,94vw);max-width:none;height:min(88vh,900px);max-height:none;padding:0;border:2px solid #111;background:#fffdf7;color:#111}
      dialog.source-audit-dialog::backdrop{background:rgba(0,0,0,.72)}
      .source-audit-page{padding:clamp(18px,4vw,42px);overflow:auto;height:100%;box-sizing:border-box}
      .source-audit-head{display:flex;justify-content:space-between;gap:24px;border-bottom:7px double #111;padding-bottom:14px}
      .source-audit-head span{font:900 10px Arial,sans-serif;letter-spacing:.15em;color:#c40000}.source-audit-head h2{font:900 clamp(38px,7vw,76px)/.9 Georgia,serif;letter-spacing:-.05em;margin:5px 0}.source-audit-head p{font:15px/1.4 Arial,sans-serif;max-width:720px;margin:0}
      .source-audit-close{align-self:flex-start;border:1px solid #111;background:#fff;padding:8px 10px;font:900 10px Arial,sans-serif;cursor:pointer}
      .audit-summary{display:grid;grid-template-columns:1fr 1fr 1fr;background:linear-gradient(90deg,#d9e8fa 0 49%,#e9e6db 49% 51%,#f7ddd5 51% 100%);margin:20px 0 10px;border:1px solid #111}
      .audit-summary div{display:grid;place-items:center;padding:13px 5px}.audit-summary b{font:900 22px Georgia,serif}.audit-summary span{font:900 9px Arial,sans-serif;letter-spacing:.09em}
      .audit-info-button{border:1px solid #111;background:#fff;padding:9px 12px;font:900 11px Arial,sans-serif;letter-spacing:.08em;cursor:pointer}
      .audit-info-button:hover,.audit-info-button:focus-visible{background:#111;color:#fff}
      .audit-method{border:2px solid #111;margin:9px 0 18px;padding:16px;background:#f4f0e5}.audit-method h3{font:900 24px Georgia,serif;margin:0 0 8px}.audit-method>p{font:13px/1.5 Arial,sans-serif}
      .audit-scale{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:14px 0}.audit-scale div{border-top:4px solid #111;background:#fff;padding:10px}.audit-scale b,.audit-scale span{display:block}.audit-scale b{font:900 17px Georgia,serif}.audit-scale span{font:900 10px Arial,sans-serif;color:#c40000;margin:3px 0}.audit-scale p{font:11px/1.35 Arial,sans-serif;margin:0}
      .audit-list-head{display:flex;align-items:end;justify-content:space-between;gap:20px;margin:24px 0 8px}.audit-list-head h3{font:900 23px Georgia,serif;margin:0}.audit-list-head p{font:12px Arial,sans-serif;margin:4px 0}.audit-list-head label{font:900 9px Arial,sans-serif;letter-spacing:.08em}.audit-list-head input{display:block;width:min(320px,72vw);border:1px solid #111;background:#fff;padding:8px;margin-top:4px;font:13px Arial,sans-serif}
      .audit-source-list{border-top:3px solid #111}.audit-source-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:24px;border-bottom:1px solid #999;padding:12px 2px}.audit-source-row h3{font:900 18px Georgia,serif;margin:0 0 4px}.audit-source-row p{font:12px/1.42 Arial,sans-serif;margin:0;color:#444}.audit-source-rating{display:flex;flex-direction:column;align-items:flex-end;min-width:210px}.audit-source-rating span:last-child{font:800 9px Arial,sans-serif;color:#666;text-transform:uppercase}
      @media(max-width:700px){dialog.source-audit-dialog{width:100vw;height:100vh}.source-audit-head{gap:10px}.audit-scale{grid-template-columns:1fr 1fr}.audit-list-head{align-items:stretch;flex-direction:column}.audit-source-row{grid-template-columns:1fr}.audit-source-rating{align-items:flex-start;min-width:0}}
    `;
    document.head.appendChild(style);
  }

  function patchSourceLinks() {
    if (typeof global.sourceHTML !== "function" || global.sourceHTML.__sourceAuditPatched) return;
    const original = global.sourceHTML;
    const audited = function auditedSourceHTML(source) {
      return `<div class="audited-source">${original(source)}${sourceBadgeHTML(source)}</div>`;
    };
    audited.__sourceAuditPatched = true;
    global.sourceHTML = audited;
  }

  const api = Object.freeze({
    reviewedOn: REVIEWED_ON,
    scale: SCALE,
    profileFor,
    designation,
    auditEvent,
    scoreText,
    badgeHTML,
    sourceBadgeHTML,
    searchTermsFor,
    collectSiteSources,
    auditButtonHTML,
    open,
    bind
  });
  global.WLC_SOURCE_AUDIT = api;
  injectStyles();
  patchSourceLinks();
})(globalThis);
