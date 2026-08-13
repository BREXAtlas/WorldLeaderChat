"use strict";

(function installWorldLeaderChatExperience(global) {
  const CARD_FULL_SUMMARY_WORDS = 62;
  const CARD_TEASER_WORDS = 30;
  const TICKER_LIMIT = 12;
  const RELATED_WINDOW_DAYS = 21;
  const STOP_WORDS = new Set([
    "about", "after", "again", "against", "along", "among", "because", "before", "being", "below", "between",
    "could", "first", "from", "have", "into", "latest", "more", "most", "news", "other", "over", "report", "reports",
    "said", "says", "same", "some", "than", "that", "their", "them", "then", "there", "these", "they", "this", "those",
    "through", "under", "very", "what", "when", "where", "which", "while", "will", "with", "would", "world"
  ]);

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[character]);
  }

  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function wordList(value) {
    return String(value || "").trim().split(/\s+/).filter(Boolean);
  }

  function truncateWords(value, limit) {
    const words = wordList(value);
    if (words.length <= limit) return { teaser: words.join(" "), remainder: "", truncated: false };
    return { teaser: `${words.slice(0, limit).join(" ")}…`, remainder: words.slice(limit).join(" "), truncated: true };
  }

  function sectionFor(event) {
    return global.WLC_NEWSROOM?.sectionFor(event) || event?.category || "World News";
  }

  function sourceMixBadge(event, className = "") {
    return global.WLC_SOURCE_AUDIT?.badgeHTML(event, className) || "";
  }

  function compactStoryHTML(event) {
    const desk = sectionFor(event);
    const summaryWords = wordList(event.summary).length;
    const long = summaryWords > CARD_FULL_SUMMARY_WORDS;
    const summary = truncateWords(event.summary, long ? CARD_TEASER_WORDS : CARD_FULL_SUMMARY_WORDS);
    const status = event.published
      ? '<span class="custom-badge">EDITOR-APPROVED UPDATE</span>'
      : event.custom
        ? '<span class="custom-badge">LOCAL PREVIEW</span>'
        : "";
    const body = long
      ? `<p class="summary story-teaser">${esc(summary.teaser)}</p>
        <details class="story-drawer">
          <summary>READ MORE <span aria-hidden="true">＋</span></summary>
          <div class="story-drawer-body"><p>${esc(summary.remainder)}</p><div class="meme">${esc(event.meme)}</div><button type="button" data-open="${esc(event.id)}" class="open-full-file">OPEN FULL FILE + CHAT →</button></div>
        </details>`
      : `<p class="summary">${esc(summary.teaser)}</p><div class="meme">${esc(event.meme)}</div>`;
    return `<article class="story">
      <div class="tag">${esc(desk)} ${status}</div>
      <h3><button type="button" data-open="${esc(event.id)}">${esc(event.title)}</button></h3>
      <div class="meta">${esc(event.date)}</div>
      ${sourceMixBadge(event)}
      <div class="kicker">${esc(event.kicker)}</div>
      ${body}
    </article>`;
  }

  function eventTime(event) {
    const machine = String(event?.eventDate || "").match(/^\d{4}-\d{2}-\d{2}$/);
    if (machine) return Date.parse(`${event.eventDate}T12:00:00Z`) || 0;
    const parsed = Date.parse(String(event?.date || ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function recencySort(a, b) {
    const date = eventTime(b) - eventTime(a);
    if (date) return date;
    const issue = Number(b?.editorial?.issueNumber || 0) - Number(a?.editorial?.issueNumber || 0);
    if (issue) return issue;
    return String(b?.id || "").localeCompare(String(a?.id || ""));
  }

  function explicitGroup(event) {
    return normalize(event?.eventGroup || event?.relatedGroup || event?.editorial?.eventGroup || event?.editorial?.relatedGroup);
  }

  function eventTokens(event) {
    const text = `${event?.title || ""} ${event?.kicker || ""} ${event?.article?.headline || ""} ${event?.article?.dek || ""}`;
    return new Set(normalize(text).split(/\s+/).filter((token) => token.length > 3 && !STOP_WORDS.has(token)));
  }

  function sharedSourceUrl(a, b) {
    const urls = new Set((a?.sources || []).map((source) => String(source.url || "").split(/[?#]/)[0]).filter(Boolean));
    return (b?.sources || []).some((source) => urls.has(String(source.url || "").split(/[?#]/)[0]));
  }

  function sameEvent(a, b) {
    if (!a || !b || a.id === b.id) return Boolean(a && b && a.id === b.id);
    const aGroup = explicitGroup(a);
    const bGroup = explicitGroup(b);
    if (aGroup && bGroup) return aGroup === bGroup;
    if (sharedSourceUrl(a, b)) return true;
    const age = Math.abs(eventTime(a) - eventTime(b)) / 86400000;
    if (!Number.isFinite(age) || age > RELATED_WINDOW_DAYS) return false;
    const aTokens = eventTokens(a);
    const bTokens = eventTokens(b);
    const shared = [...aTokens].filter((token) => bTokens.has(token));
    const union = new Set([...aTokens, ...bTokens]);
    const similarity = union.size ? shared.length / union.size : 0;
    return shared.length >= 6 || (shared.length >= 4 && similarity >= 0.2) || (shared.length >= 3 && similarity >= 0.32);
  }

  function clusters(events) {
    const list = [...(events || [])];
    const parent = list.map((_, index) => index);
    const find = (index) => parent[index] === index ? index : (parent[index] = find(parent[index]));
    const join = (a, b) => {
      const left = find(a);
      const right = find(b);
      if (left !== right) parent[right] = left;
    };
    for (let left = 0; left < list.length; left += 1) {
      for (let right = left + 1; right < list.length; right += 1) {
        if (sameEvent(list[left], list[right])) join(left, right);
      }
    }
    const grouped = new Map();
    list.forEach((event, index) => {
      const key = find(index);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(event);
    });
    return [...grouped.values()].map((group) => group.sort(recencySort));
  }

  function relatedEvents(event, universe) {
    if (!event) return [];
    const group = clusters(universe || []).find((items) => items.some((item) => item.id === event.id));
    return (group || []).filter((item) => item.id !== event.id).sort(recencySort);
  }

  function collapseRelated(events, universe = events) {
    const inputIds = new Set((events || []).map((event) => event.id));
    const representatives = clusters(universe || [])
      .filter((group) => group.some((event) => inputIds.has(event.id)))
      .map((group) => group[0]);
    return representatives.sort(recencySort);
  }

  function featuredEvents(events) {
    const collapsed = collapseRelated(events || [], typeof global.allEvents === "function" ? global.allEvents() : events);
    const desks = global.WLC_NEWSROOM?.desks || [...new Set(collapsed.map(sectionFor))];
    const result = [];
    for (const desk of desks) {
      const candidates = collapsed.filter((event) => sectionFor(event) === desk).sort(recencySort);
      const selected = candidates.find((event) => event.featured) || candidates[0];
      if (selected) result.push(selected);
    }
    return result;
  }

  function carouselArticle(event, index) {
    const desk = sectionFor(event);
    const manual = event.featured ? "EDITOR FEATURE" : "TOP DESK FILE";
    const summary = truncateWords(event.summary, 48).teaser;
    return `<article class="lead featured-slide" data-carousel-index="${index}" data-desk="${esc(desk)}" ${index ? "hidden" : ""}>
      <div class="tag">${esc(manual)} // ${esc(desk)}</div>
      <h2><button type="button" data-open="${esc(event.id)}">${esc(event.title)}</button></h2>
      ${sourceMixBadge(event, "lead-source-mix")}
      <div class="kicker">${esc(event.kicker)}</div>
      <p class="summary">${esc(summary)}</p>
      <button type="button" data-open="${esc(event.id)}" class="lead-read-more">READ THE FULL FILE →</button>
    </article>`;
  }

  function experienceRenderTopline(filtered) {
    const featured = featuredEvents(filtered || []);
    const topline = document.getElementById("topline");
    if (!topline) return;
    if (!featured.length) {
      topline.innerHTML = "";
      return;
    }
    const events = typeof global.allEvents === "function" ? global.allEvents() : filtered;
    const years = events.map((event) => Number(event.year)).filter(Number.isFinite);
    const range = years.length ? `${Math.min(...years)}–${Math.max(...years)}` : "ARCHIVE";
    const auditTab = global.WLC_SOURCE_AUDIT?.auditButtonHTML() || "";
    topline.innerHTML = `<section class="featured-carousel" aria-label="Featured newsroom files">
      <div class="featured-carousel-head"><span>FEATURED ACROSS THE NEWSROOM</span><span class="carousel-count">1 / ${featured.length}</span></div>
      <div class="featured-slides">${featured.map(carouselArticle).join("")}</div>
      <div class="featured-carousel-controls">
        <button type="button" class="carousel-arrow carousel-prev" aria-label="Previous featured file">←</button>
        <div class="carousel-dots" aria-label="Choose featured desk">${featured.map((event, index) => `<button type="button" data-carousel-go="${index}" class="${index ? "" : "active"}" aria-label="Show ${esc(sectionFor(event))}" aria-current="${index ? "false" : "true"}"></button>`).join("")}</div>
        <button type="button" class="carousel-arrow carousel-next" aria-label="Next featured file">→</button>
      </div>
    </section>
    <aside class="sidebox">
      <h3>HOW TO READ THE FILE</h3>
      <p>The front page carries the urgency of an old-school link newspaper. Open a headline for the sourced short report and the imagined off-mic conversation.</p>
      <div class="legend"><span class="fiction">GREEN = PRIVATE REACTION</span><span class="record">YELLOW = PUBLIC RECORD</span><span class="sys">GRAY = CHAT NOTE</span></div>
      <p><b>${events.length} events</b> • ${esc(range)} • searchable by leader, crisis, event, source or source orientation.</p>
      ${auditTab}
      ${typeof global.sponsorHTML === "function" ? global.sponsorHTML() : ""}
    </aside>`;
    bind();
  }

  function tickerEvents(events, limit = TICKER_LIMIT) {
    const universe = typeof global.allEvents === "function" ? global.allEvents() : events;
    const sorted = collapseRelated(events || [], universe).sort(recencySort);
    const selected = [];
    const desks = new Set();
    for (const event of sorted) {
      const desk = sectionFor(event);
      if (desks.has(desk)) continue;
      selected.push(event);
      desks.add(desk);
      if (selected.length === limit) return selected;
    }
    for (const event of sorted) {
      if (selected.some((item) => item.id === event.id)) continue;
      selected.push(event);
      if (selected.length === limit) break;
    }
    return selected;
  }

  function tickerItem(event, interactive = true) {
    const contents = `<span>${esc(sectionFor(event))}</span>${esc(event.title)}`;
    return interactive
      ? `<button type="button" data-open="${esc(event.id)}" class="ticker-item">${contents}</button>`
      : `<span class="ticker-item">${contents}</span>`;
  }

  function tickerHTML(events) {
    const selected = tickerEvents(events, TICKER_LIMIT);
    if (!selected.length) return "";
    const primary = selected.map((event) => tickerItem(event, true)).join("");
    const duplicate = selected.map((event) => tickerItem(event, false)).join("");
    return `<section class="news-ticker" aria-label="Recently published files">
      <div class="ticker-label"><b>NEW FILES</b><span>${selected.length} / ${TICKER_LIMIT} MAX • DESK-BALANCED</span></div>
      <div class="ticker-window"><div class="ticker-track"><div class="ticker-set">${primary}</div><div class="ticker-set" aria-hidden="true" inert>${duplicate}</div></div></div>
    </section>`;
  }

  function relatedCoverageHTML(event) {
    const universe = typeof global.allEvents === "function" ? global.allEvents() : [];
    const related = relatedEvents(event, universe);
    if (!related.length) return "";
    return `<details class="related-coverage">
      <summary><span>RELATED COVERAGE</span><strong>${related.length} SAME-EVENT ${related.length === 1 ? "ARTICLE" : "ARTICLES"}</strong><b aria-hidden="true">＋</b></summary>
      <div class="related-coverage-head"><h3>CHECK OUT THESE RELATED ARTICLES</h3><p>These approved files cover the same underlying event from another source or publication point—not merely the same broad topic.</p></div>
      <div class="related-coverage-list">${related.map((item) => `<article>
        <div><span>${esc(item.date)} • ${esc(sectionFor(item))}</span><h4><button type="button" data-related-open="${esc(item.id)}">${esc(item.title)}</button></h4><p>${esc([...new Set((item.sources || []).map((source) => source.publisher).filter(Boolean))].join(" + ") || "Original sources")}</p></div>
        ${sourceMixBadge(item, "related-source-mix")}
      </article>`).join("")}</div></details>`;
  }

  function renderRelatedCoverage(event) {
    const sources = document.querySelector(".fact-panel .sources");
    if (!sources) return;
    sources.querySelector(".related-coverage")?.remove();
    const html = relatedCoverageHTML(event);
    if (!html) return;
    sources.insertAdjacentHTML("beforeend", html);
    sources.querySelectorAll("[data-related-open]").forEach((button) => {
      button.onclick = () => {
        if (typeof global.openEvent === "function") global.openEvent(button.dataset.relatedOpen);
      };
    });
  }

  function showCarousel(index) {
    const carousel = document.querySelector(".featured-carousel");
    if (!carousel) return;
    const slides = [...carousel.querySelectorAll(".featured-slide")];
    if (!slides.length) return;
    const next = ((Number(index) % slides.length) + slides.length) % slides.length;
    carousel.dataset.index = String(next);
    slides.forEach((slide, slideIndex) => { slide.hidden = slideIndex !== next; });
    carousel.querySelectorAll("[data-carousel-go]").forEach((dot, dotIndex) => {
      dot.classList.toggle("active", dotIndex === next);
      dot.setAttribute("aria-current", String(dotIndex === next));
    });
    const count = carousel.querySelector(".carousel-count");
    if (count) count.textContent = `${next + 1} / ${slides.length}`;
  }

  function bind() {
    if (!global.document) return;
    const carousel = document.querySelector(".featured-carousel");
    if (carousel) {
      carousel.querySelector(".carousel-prev").onclick = () => showCarousel(Number(carousel.dataset.index || 0) - 1);
      carousel.querySelector(".carousel-next").onclick = () => showCarousel(Number(carousel.dataset.index || 0) + 1);
      carousel.querySelectorAll("[data-carousel-go]").forEach((button) => {
        button.onclick = () => showCarousel(Number(button.dataset.carouselGo));
      });
    }
    global.WLC_SOURCE_AUDIT?.bind();
  }

  function injectStyles() {
    if (!global.document || document.getElementById("newsroom-experience-style")) return;
    const style = document.createElement("style");
    style.id = "newsroom-experience-style";
    style.textContent = `
      .story-drawer{margin:7px 0 0;border-top:1px solid #999}.story-drawer>summary{display:flex;justify-content:space-between;align-items:center;list-style:none;cursor:pointer;padding:8px 1px;font:900 10px Arial,sans-serif;letter-spacing:.09em;color:#c40000}.story-drawer>summary::-webkit-details-marker{display:none}.story-drawer[open]>summary span{transform:rotate(45deg)}
      .story-drawer-body{padding:0 0 7px}.story-drawer-body p{font:13px/1.42 Arial,sans-serif;margin:0 0 7px}.open-full-file,.lead-read-more{border:0;background:#111;color:#fff;padding:8px 10px;font:900 9px Arial,sans-serif;letter-spacing:.08em;cursor:pointer}.open-full-file:hover,.lead-read-more:hover{background:#c40000}
      .featured-carousel{min-width:0;border-right:1px solid #aaa;padding-right:18px}.featured-carousel-head{display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid #111;padding-bottom:5px;font:900 9px Arial,sans-serif;letter-spacing:.1em;color:#c40000}
      .featured-carousel .lead{border-right:0;padding:12px 0 5px;min-height:310px}.featured-slide[hidden]{display:none}.featured-carousel-controls{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px;border-top:2px solid #111;padding-top:8px}.carousel-arrow{border:1px solid #111;background:#fff;width:34px;height:30px;font:900 18px Arial,sans-serif;cursor:pointer}.carousel-arrow:hover,.carousel-arrow:focus-visible{background:#111;color:#fff}.carousel-dots{display:flex;justify-content:center;gap:6px;flex-wrap:wrap}.carousel-dots button{width:9px;height:9px;border:1px solid #111;border-radius:50%;padding:0;background:#fff;cursor:pointer}.carousel-dots button.active{background:#c40000;border-color:#c40000}
      .news-ticker{display:grid;grid-template-columns:auto minmax(0,1fr);border-top:3px solid #111;border-bottom:1px solid #111;margin:18px 0 0;background:#fff;overflow:hidden}.ticker-label{position:relative;z-index:2;background:#c40000;color:#fff;padding:9px 12px;display:flex;flex-direction:column;justify-content:center}.ticker-label b{font:900 11px Arial,sans-serif;letter-spacing:.1em}.ticker-label span{font:800 7px Arial,sans-serif;letter-spacing:.05em;white-space:nowrap}.ticker-window{min-width:0;overflow:hidden;display:flex;align-items:center}.ticker-track{display:flex;width:max-content;animation:wlcTicker 85s linear infinite}.ticker-set{display:flex;align-items:center;gap:28px;padding-right:28px}.ticker-item{display:inline-flex;align-items:center;gap:8px;white-space:nowrap;border:0;background:transparent;padding:9px 0;font:900 12px Georgia,serif;color:#111;cursor:pointer}.ticker-item span{font:900 8px Arial,sans-serif;color:#c40000;letter-spacing:.08em;text-transform:uppercase}.ticker-item:hover{text-decoration:underline}.news-ticker:hover .ticker-track,.news-ticker:focus-within .ticker-track{animation-play-state:paused}@keyframes wlcTicker{to{transform:translateX(-50%)}}
      .related-coverage{border-top:1px solid #999;margin-top:10px;padding-top:0}.related-coverage>summary{display:grid;grid-template-columns:1fr auto auto;align-items:center;gap:8px;cursor:pointer;list-style:none;padding:9px 0;font:900 9px Arial,sans-serif;letter-spacing:.08em}.related-coverage>summary::-webkit-details-marker{display:none}.related-coverage>summary span{color:#c40000}.related-coverage>summary b{font-size:16px}.related-coverage[open]>summary b{transform:rotate(45deg)}.related-coverage-head{padding:4px 0 8px}.related-coverage-head h3{font:900 18px/1 Georgia,serif!important;margin:4px 0 6px!important}.related-coverage-head p{font:12px/1.4 Arial,sans-serif!important;color:#555}.related-coverage-list{border-top:2px solid #111}.related-coverage-list article{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;padding:11px 0;border-bottom:1px solid #aaa}.related-coverage-list article>div>span{font:900 8px Arial,sans-serif;color:#666;letter-spacing:.08em}.related-coverage-list h4{font:900 18px/1.05 Georgia,serif;margin:4px 0}.related-coverage-list h4 button{border:0;background:transparent;padding:0;text-align:left;font:inherit;cursor:pointer}.related-coverage-list h4 button:hover{text-decoration:underline}.related-coverage-list p{font:11px Arial,sans-serif!important;margin:0!important}.related-source-mix{align-self:start}
      @media(prefers-reduced-motion:reduce){.ticker-track{animation:none}.ticker-set[aria-hidden="true"]{display:none}}
      @media(max-width:900px){.featured-carousel{border-right:0;padding-right:0;border-bottom:2px solid #111;padding-bottom:12px}.featured-carousel .lead{min-height:0}.news-ticker{grid-template-columns:1fr}.ticker-label{flex-direction:row;justify-content:space-between;gap:10px}.related-coverage-list article{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  if (typeof global.storyHTML === "function") global.storyHTML = compactStoryHTML;
  if (typeof global.leadEvent === "function") global.leadEvent = (events) => featuredEvents(events)[0];
  if (typeof global.renderTopline === "function") global.renderTopline = experienceRenderTopline;
  if (typeof global.openEvent === "function") {
    const originalOpenEvent = global.openEvent;
    global.openEvent = function openEventWithRelatedCoverage(id, pushHash = true) {
      const result = originalOpenEvent(id, pushHash);
      const event = typeof global.allEvents === "function" ? global.allEvents().find((item) => item.id === id) : null;
      if (event) setTimeout(() => renderRelatedCoverage(event), 0);
      return result;
    };
  }

  const api = Object.freeze({
    cardFullSummaryWords: CARD_FULL_SUMMARY_WORDS,
    cardTeaserWords: CARD_TEASER_WORDS,
    tickerLimit: TICKER_LIMIT,
    compactStoryHTML,
    sameEvent,
    clusters,
    relatedEvents,
    collapseRelated,
    featuredEvents,
    tickerEvents,
    tickerHTML,
    relatedCoverageHTML,
    renderRelatedCoverage,
    renderTopline: experienceRenderTopline,
    bind
  });
  global.WLC_NEWSROOM_EXPERIENCE = api;
  injectStyles();
})(globalThis);
