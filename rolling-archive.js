"use strict";

(function installMonthlyWorldLeaderChatArchive() {
  const TIME_ZONE = "America/Chicago";
  const MINIMUM_VISIBLE_FILES = 10;

  // These source issues were merged into canonical multi-source files. Keep a
  // display guard so an older cached data artifact cannot put them back on the page.
  const MERGED_DISPLAY_IDS = new Set([
    "2026-08-08-child-among-three-killed-in-russian-missile-attacks-near-kyiv",
    "2026-08-06-iran-aims-to-ban-u-s-and-israeli-ships-from-strait-of-hormuz-and"
  ]);

  const MONTH_INDEX = new Map([
    ["january", 0], ["february", 1], ["march", 2], ["april", 3],
    ["may", 4], ["june", 5], ["july", 6], ["august", 7],
    ["september", 8], ["october", 9], ["november", 10], ["december", 11]
  ]);

  function chicagoToday() {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)));
  }

  function parseEventDate(event) {
    const machine = String(event?.eventDate || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (machine) {
      return new Date(Date.UTC(Number(machine[1]), Number(machine[2]) - 1, Number(machine[3])));
    }

    // Original built-in files predate eventDate. Dates can be a single day or a
    // displayed range such as "June 15–17, 2026"; the first day determines month.
    const display = String(event?.date || "").trim();
    const human = display.match(/^([A-Za-z]+)\s+(\d{1,2})(?:[–—-]\d{1,2})?,\s*(\d{4})$/);
    if (!human) return null;
    const monthIndex = MONTH_INDEX.get(human[1].toLowerCase());
    if (monthIndex === undefined) return null;
    return new Date(Date.UTC(Number(human[3]), monthIndex, Number(human[2])));
  }

  function isoDate(date) {
    if (!date) return "";
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function formatMonth(year, monthIndex) {
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC"
    }).format(new Date(Date.UTC(year, monthIndex, 1))).toUpperCase();
  }

  function sectionFor(event) {
    if (globalThis.WLC_NEWSROOM) return globalThis.WLC_NEWSROOM.sectionFor(event);
    const text = `${event.category || ""} ${event.title || ""} ${event.summary || ""}`.toLowerCase();
    if (/technology|artificial intelligence|\bai\b|cyber|tiktok|openai|chip|semiconductor/.test(text)) return "Technology & AI";
    if (/science|space|rocket|nasa|spacex|moon|mars|telescope|discovery/.test(text)) return "Science & Space";
    if (/business|economy|trade|tariff|market|company|billionaire|antitrust/.test(text)) return "Business & Power";
    if (/culture|entertainment|music|song|album|film|movie|television|hbo|copyright|taylor swift|larry david/.test(text)) return "Culture & Entertainment";
    if (/sports|sport|olympics|world cup|championship|medal|fifa/.test(text)) return "Sports & Soft Power";
    if (/election|congress|court|immigration|border|protest|civil rights|health|society/.test(text)) return "Politics & Society";
    return "World News";
  }

  function visualDesk(event) {
    if (globalThis.WLC_NEWSROOM) return globalThis.WLC_NEWSROOM.sectionFor(event);
    const text = `${event.category || ""} ${event.title || ""} ${event.summary || ""}`.toLowerCase();
    if (/war|security|airstrike|missile|attack|hostage|gaza|ukraine|russia|iran|hormuz|israel|military/.test(text)) return "War & Security";
    if (/science|space|rocket|nasa|spacex|moon|mars|telescope|discovery/.test(text)) return "Science & Space";
    if (/technology|artificial intelligence|\bai\b|cyber|tiktok|openai|chip|semiconductor/.test(text)) return "Technology & AI";
    if (/election|congress|court|immigration|border|protest|civil rights|health|society/.test(text)) return "Politics & Society";
    if (/business|economy|trade|tariff|market|company|billionaire|antitrust/.test(text)) return "Business & Power";
    if (/culture|entertainment|music|song|album|film|movie|television|hbo|copyright|taylor swift|larry david/.test(text)) return "Culture & Entertainment";
    if (/sports|sport|olympics|world cup|championship|medal|fifa/.test(text)) return "Sports & Soft Power";
    return "World News";
  }

  function activeDesk() {
    return document.querySelector("#newsroomFilter button.active")?.dataset.newsroomCategory || "all";
  }

  function deskMatches(event) {
    const selected = activeDesk();
    return selected === "all" || sectionFor(event) === selected;
  }

  function normalizeTitle(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function dedupeEvents(events) {
    const seenIds = new Set();
    const seenTitleDates = new Set();
    const seenSources = new Set();
    const output = [];

    for (const event of events) {
      if (!event?.id || MERGED_DISPLAY_IDS.has(event.id) || seenIds.has(event.id)) continue;
      const sourceUrls = (event.sources || []).map((source) => source.url).filter(Boolean);
      if (sourceUrls.some((url) => seenSources.has(url))) continue;

      const titleDate = `${isoDate(parseEventDate(event))}|${normalizeTitle(event.title)}`;
      if (seenTitleDates.has(titleDate)) continue;

      seenIds.add(event.id);
      seenTitleDates.add(titleDate);
      sourceUrls.forEach((url) => seenSources.add(url));
      output.push(event);
    }
    return output;
  }

  function storyWeight(event) {
    return 6
      + Math.ceil(String(event.title || "").length / 34)
      + Math.ceil(String(event.kicker || "").length / 70)
      + Math.ceil(String(event.meme || "").length / 60);
  }

  function storyWithDesk(event) {
    const desk = visualDesk(event);
    return storyHTML(event)
      .replace('<article class="story">', `<article class="story" data-desk="${esc(desk)}">`)
      .replace('<div class="tag">', `<div class="tag" data-section="${esc(sectionFor(event))}">`);
  }

  function balancedColumns(events, count = 3, className = "current-column") {
    const buckets = Array.from({ length: count }, () => ({ weight: 0, events: [] }));
    for (const event of events) {
      const target = buckets.reduce((best, bucket) => bucket.weight < best.weight ? bucket : best, buckets[0]);
      target.events.push(event);
      target.weight += storyWeight(event);
    }
    return buckets
      .map((bucket) => `<div class="${className}">${bucket.events.map(storyWithDesk).join("")}</div>`)
      .join("");
  }

  function colorLead(event) {
    const lead = document.querySelector("#topline .lead");
    if (lead && event) lead.dataset.desk = visualDesk(event);
  }

  function eventsInMonth(events, year, monthIndex) {
    return events.filter((event) => {
      const date = parseEventDate(event);
      return date && date.getUTCFullYear() === year && date.getUTCMonth() === monthIndex;
    });
  }

  function automaticOpenMonths(events, year, currentMonthIndex, currentMonthCount) {
    const open = new Set();
    let visible = currentMonthCount;
    if (state.query || activeDesk() !== "all") return open;

    for (let monthIndex = currentMonthIndex - 1; monthIndex >= 0 && visible < MINIMUM_VISIBLE_FILES; monthIndex -= 1) {
      const count = eventsInMonth(events, year, monthIndex).length;
      if (!count) continue;
      open.add(monthIndex);
      visible += count;
    }
    return open;
  }

  function renderMonthArchive(events, year, currentMonthIndex, currentMonthCount) {
    const autoOpen = automaticOpenMonths(events, year, currentMonthIndex, currentMonthCount);
    const showEmptyMonths = !state.query && activeDesk() === "all";
    const monthBlocks = [];

    for (let monthIndex = currentMonthIndex - 1; monthIndex >= 0; monthIndex -= 1) {
      const monthEvents = eventsInMonth(events, year, monthIndex);
      if (!monthEvents.length && !showEmptyMonths) continue;
      const shouldOpen = Boolean(state.query || autoOpen.has(monthIndex));
      const content = monthEvents.length
        ? `<div class="month-grid">${balancedColumns(monthEvents, 3, "month-column")}</div>`
        : '<div class="month-empty">NO FILES PUBLISHED FOR THIS MONTH.</div>';
      monthBlocks.push(`<details class="month-archive${monthEvents.length ? "" : " empty-month"}" ${shouldOpen ? "open" : ""}>
        <summary>${esc(formatMonth(year, monthIndex))}<span>${monthEvents.length} FILE${monthEvents.length === 1 ? "" : "S"}${shouldOpen && monthEvents.length ? " • OPEN" : ""}</span></summary>
        ${content}
      </details>`);
    }

    if (!monthBlocks.length) return "";
    return `<section class="current-year-archive">
      <div class="archive-heading current-year-heading">${year} MONTH ARCHIVE</div>
      <p class="archive-explainer">Earlier months are organized below. The newest month boxes open automatically until at least ${MINIMUM_VISIBLE_FILES} current-year files are visible, when enough files exist.</p>
      ${monthBlocks.join("")}
    </section>`;
  }

  function renderOlderYearArchive(events, currentYear, selectedYear) {
    const years = [...new Set(events.map((event) => Number(event.year)).filter((year) => year < currentYear))]
      .sort((a, b) => b - a);
    const yearsToShow = selectedYear && selectedYear < currentYear ? [selectedYear] : years;
    if (!yearsToShow.length) return "";

    const details = yearsToShow.map((year) => {
      const yearEvents = events.filter((event) => Number(event.year) === year);
      if (!yearEvents.length) return "";
      const open = Boolean(selectedYear === year || state.query);
      return `<details class="year-archive" ${open ? "open" : ""}>
        <summary>${year}<span>${yearEvents.length} FILE${yearEvents.length === 1 ? "" : "S"} • OPEN YEAR</span></summary>
        <div class="archive-year-grid">${balancedColumns(yearEvents, 3, "archive-year-column")}</div>
      </details>`;
    }).join("");

    const firstHistoricYear = Math.min(...yearsToShow);
    const lastHistoricYear = Math.max(...yearsToShow);
    const range = firstHistoricYear === lastHistoricYear ? String(firstHistoricYear) : `${firstHistoricYear}–${lastHistoricYear}`;
    return `<section class="historic-archive">
      <div class="archive-heading">ARCHIVE // ${range}</div>
      ${details}
    </section>`;
  }

  function injectStyles() {
    if (document.getElementById("monthly-archive-style")) return;
    const style = document.createElement("style");
    style.id = "monthly-archive-style";
    style.textContent = `
      .current-month-title{border-top:7px double #111;border-bottom:2px solid #111;padding:8px 0 6px;margin:18px 0 0;display:flex;justify-content:space-between;align-items:flex-end;gap:18px}
      .current-month-title h2{font:900 34px/1 Georgia,serif;margin:0}.current-month-title span{font:900 11px/1.35 Arial,sans-serif;color:#c40000;letter-spacing:.08em;text-align:right}
      .current-news{display:block;width:100%;margin-bottom:30px}.current-columns{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:28px;width:100%;align-items:start}
      .current-column{min-width:0}.current-column+.current-column{border-left:1px solid #aaa;padding-left:24px}
      .current-year-archive,.historic-archive{display:block;width:100%;margin-top:26px}
      .archive-explainer{font:12px/1.45 Arial,sans-serif;color:#555;margin:0 0 12px}
      details.month-archive,details.year-archive{display:block;width:100%;background:#fffdf7}
      details.month-archive{border-top:3px solid #111;margin:0 0 10px}
      details.month-archive>summary,details.year-archive>summary{cursor:pointer;list-style:none;padding:13px 4px;font:900 24px/1 Georgia,serif;display:flex;justify-content:space-between;gap:12px}
      details.month-archive>summary::-webkit-details-marker{display:none}
      details.month-archive>summary span,details.year-archive>summary span{font:900 10px Arial,sans-serif;color:#c40000;letter-spacing:.08em}
      details.month-archive[open]>summary{border-bottom:2px solid #111}
      details.month-archive.empty-month>summary{color:#888;border-color:#bbb}
      .month-empty{padding:13px 8px 18px;font:800 11px Arial,sans-serif;color:#777}
      .month-grid,.archive-year-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;padding:8px 0 18px;width:100%}
      .month-column,.archive-year-column{min-width:0}.month-column+.month-column,.archive-year-column+.archive-year-column{border-left:1px solid #bbb;padding-left:18px}
      .current-year-heading{color:#111}
      .story[data-desk]{--desk:#3f4650;border-top:4px solid var(--desk);padding-top:8px}
      .story[data-desk] h3 button{color:var(--desk);text-decoration-color:var(--desk)}
      .story[data-desk] .tag,.lead[data-desk] .tag{color:var(--desk)}
      .story[data-desk="War & Security"],.lead[data-desk="War & Security"]{--desk:#a30d16}
      .story[data-desk="Science & Space"],.lead[data-desk="Science & Space"]{--desk:#006b63}
      .story[data-desk="Technology & AI"],.lead[data-desk="Technology & AI"]{--desk:#5d2a91}
      .story[data-desk="Politics & Society"],.lead[data-desk="Politics & Society"]{--desk:#153e75}
      .story[data-desk="Business & Power"],.lead[data-desk="Business & Power"]{--desk:#8a4b08}
      .story[data-desk="Culture & Entertainment"],.lead[data-desk="Culture & Entertainment"]{--desk:#9b175c}
      .story[data-desk="Sports & Soft Power"],.lead[data-desk="Sports & Soft Power"]{--desk:#26723a}
      .story[data-desk="World News"],.lead[data-desk="World News"]{--desk:#364552}
      .lead[data-desk] h2 button{color:var(--desk)}
      #newsroomFilter button[data-newsroom-category="War & Security"]{border-color:#a30d16;color:#a30d16}
      #newsroomFilter button[data-newsroom-category="World News"]{border-color:#364552;color:#364552}
      #newsroomFilter button[data-newsroom-category="Politics & Society"]{border-color:#153e75;color:#153e75}
      #newsroomFilter button[data-newsroom-category="Technology & AI"]{border-color:#5d2a91;color:#5d2a91}
      #newsroomFilter button[data-newsroom-category="Science & Space"]{border-color:#006b63;color:#006b63}
      #newsroomFilter button[data-newsroom-category="Business & Power"]{border-color:#8a4b08;color:#8a4b08}
      #newsroomFilter button[data-newsroom-category="Culture & Entertainment"]{border-color:#9b175c;color:#9b175c}
      #newsroomFilter button[data-newsroom-category="Sports & Soft Power"]{border-color:#26723a;color:#26723a}
      #newsroomFilter button.active{background:#111!important;color:#fff!important;border-color:#111!important}
      @media(max-width:900px){
        .current-month-title{align-items:flex-start;flex-direction:column}.current-month-title h2{font-size:27px}.current-month-title span{text-align:left}
        .current-columns,.month-grid,.archive-year-grid{grid-template-columns:1fr!important}
        .current-column+.current-column,.month-column+.month-column,.archive-year-column+.archive-year-column{border-left:0;padding-left:0}
      }
    `;
    document.head.appendChild(style);
  }

  function monthlyRender() {
    const all = dedupeEvents(allEvents());
    const filtered = all.filter((event) => matches(event) && deskMatches(event));
    renderTopline(filtered);
    colorLead(typeof leadEvent === "function" ? leadEvent(filtered) : (filtered[0] || all[0]));

    const archive = document.getElementById("archive");
    if (!archive) return;
    if (!filtered.length) {
      archive.innerHTML = '<div class="empty">NO MATCHES. EVEN THE GROUP CHAT COULD NOT MANUFACTURE A CROSSTAB.</div>';
      bindOpeners();
      return;
    }

    const today = chicagoToday();
    const currentYear = today.getUTCFullYear();
    const currentMonthIndex = today.getUTCMonth();
    const selectedYear = state.year === "all" ? null : Number(state.year);
    const showHistoricOnly = selectedYear && selectedYear < currentYear;
    let html = "";

    if (!showHistoricOnly) {
      const currentYearEvents = filtered.filter((event) => Number(event.year) === currentYear);
      const currentMonthEvents = eventsInMonth(currentYearEvents, currentYear, currentMonthIndex);
      const leadId = filtered[0]?.id;
      const leadIsCurrent = currentMonthEvents.some((event) => event.id === leadId);
      const gridEvents = currentMonthEvents.filter((event) => !leadIsCurrent || event.id !== leadId);
      const belowCount = gridEvents.length;

      html += `<section class="current-news">
        <div class="current-month-title">
          <h2>${esc(formatMonth(currentYear, currentMonthIndex))} // CURRENT MONTH</h2>
          <span>${currentMonthEvents.length} FILE${currentMonthEvents.length === 1 ? "" : "S"}${leadIsCurrent ? ` • 1 FEATURED ABOVE • ${belowCount} BELOW` : ""}</span>
        </div>
        ${gridEvents.length
          ? `<div class="current-columns">${balancedColumns(gridEvents, 3)}</div>`
          : leadIsCurrent
            ? '<div class="empty">THE CURRENT MONTH’S FEATURED FILE IS ABOVE.</div>'
            : '<div class="empty">NO CURRENT-MONTH FILES MATCH THIS VIEW.</div>'}
      </section>`;

      html += renderMonthArchive(currentYearEvents, currentYear, currentMonthIndex, currentMonthEvents.length);
    }

    if (!selectedYear || selectedYear < currentYear) {
      html += renderOlderYearArchive(filtered, currentYear, selectedYear);
    }

    archive.innerHTML = html || '<div class="empty">NO ARCHIVED FILES MATCH THIS VIEW.</div>';
    bindOpeners();
  }

  injectStyles();
  if (typeof render === "function") render = monthlyRender;
  setTimeout(() => {
    injectStyles();
    if (typeof render === "function") render();
  }, 0);
})();
