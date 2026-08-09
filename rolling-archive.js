"use strict";

(function installRollingWorldLeaderChatArchive() {
  const TIME_ZONE = "America/Chicago";
  const DAYS_BEFORE_TODAY = 7;

  // These files were published from separate source issues covering the same
  // underlying event. The data-cleanup workflow removes them permanently; the
  // display guard prevents a stale Pages artifact from showing them twice.
  const MERGED_DISPLAY_IDS = new Set([
    "2026-08-08-child-among-three-killed-in-russian-missile-attacks-near-kyiv",
    "2026-08-06-iran-aims-to-ban-u-s-and-israeli-ships-from-strait-of-hormuz-and"
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
    const match = String(event?.eventDate || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  }

  function addDays(date, amount) {
    const copy = new Date(date.getTime());
    copy.setUTCDate(copy.getUTCDate() + amount);
    return copy;
  }

  function dateValue(event) {
    return parseEventDate(event)?.getTime() ?? Number.NEGATIVE_INFINITY;
  }

  function formatRange(start, end) {
    const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
    const sameMonth = sameYear && start.getUTCMonth() === end.getUTCMonth();
    const month = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" });
    if (sameMonth) {
      return `${month.format(start).toUpperCase()} ${start.getUTCDate()}–${end.getUTCDate()}, ${end.getUTCFullYear()}`;
    }
    const startText = `${month.format(start).toUpperCase()} ${start.getUTCDate()}${sameYear ? "" : `, ${start.getUTCFullYear()}`}`;
    const endText = `${month.format(end).toUpperCase()} ${end.getUTCDate()}, ${end.getUTCFullYear()}`;
    return `${startText}–${endText}`;
  }

  function formatMonth(year, monthIndex) {
    const date = new Date(Date.UTC(year, monthIndex, 1));
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC"
    }).format(date).toUpperCase();
  }

  function formatDay(date) {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC"
    }).format(date).toUpperCase();
  }

  function sectionFor(event) {
    const text = `${event.category || ""} ${event.title || ""} ${event.summary || ""}`.toLowerCase();
    if (/technology|artificial intelligence|\bai\b|cyber|tiktok|openai|chip|semiconductor/.test(text)) return "Technology & AI";
    if (/science|space|rocket|nasa|spacex|moon|mars|telescope|discovery/.test(text)) return "Science & Space";
    if (/business|economy|trade|tariff|market|company|billionaire|antitrust/.test(text)) return "Business & Power";
    if (/culture|entertainment|music|song|album|film|movie|television|hbo|copyright|taylor swift|larry david/.test(text)) return "Culture & Entertainment";
    if (/sports|olympics|world cup|championship|medal|fifa/.test(text)) return "Sports & Soft Power";
    if (/election|congress|court|immigration|border|protest|civil rights|health|society/.test(text)) return "Politics & Society";
    return "World News";
  }

  function visualDesk(event) {
    const text = `${event.category || ""} ${event.title || ""} ${event.summary || ""}`.toLowerCase();
    if (/war|security|airstrike|missile|attack|hostage|gaza|ukraine|russia|iran|hormuz|israel|military/.test(text)) return "War & Security";
    if (/science|space|rocket|nasa|spacex|moon|mars|telescope|discovery/.test(text)) return "Science & Space";
    if (/technology|artificial intelligence|\bai\b|cyber|tiktok|openai|chip|semiconductor/.test(text)) return "Technology & AI";
    if (/election|congress|court|immigration|border|protest|civil rights|health|society/.test(text)) return "Politics & Society";
    if (/business|economy|trade|tariff|market|company|billionaire|antitrust/.test(text)) return "Business & Power";
    if (/culture|entertainment|music|song|album|film|movie|television|hbo|copyright|taylor swift|larry david/.test(text)) return "Culture & Entertainment";
    if (/sports|olympics|world cup|championship|medal|fifa/.test(text)) return "Sports & Soft Power";
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

      const titleDate = `${event.eventDate || ""}|${normalizeTitle(event.title)}`;
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

  function groupCurrentYearArchive(events) {
    const months = new Map();
    for (const event of events) {
      const date = parseEventDate(event);
      if (!date) continue;
      const monthIndex = date.getUTCMonth();
      if (!months.has(monthIndex)) months.set(monthIndex, new Map());
      const days = months.get(monthIndex);
      const dayKey = event.eventDate;
      if (!days.has(dayKey)) days.set(dayKey, []);
      days.get(dayKey).push(event);
    }
    return months;
  }

  function renderCurrentYearArchive(events, year) {
    if (!events.length) return "";
    const months = groupCurrentYearArchive(events);
    const searchOpen = Boolean(state.query);
    const monthHtml = [...months.entries()]
      .sort(([a], [b]) => b - a)
      .map(([monthIndex, days]) => {
        const count = [...days.values()].reduce((total, list) => total + list.length, 0);
        const dayHtml = [...days.entries()]
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([dayKey, dayEvents]) => {
            const date = parseEventDate({ eventDate: dayKey });
            return `<details class="day-archive" ${searchOpen ? "open" : ""}>
              <summary>${esc(formatDay(date))}<span>${dayEvents.length} FILE${dayEvents.length === 1 ? "" : "S"}</span></summary>
              <div class="archive-day-grid">${balancedColumns(dayEvents, 3, "archive-day-column")}</div>
            </details>`;
          }).join("");
        return `<details class="month-archive" ${searchOpen ? "open" : ""}>
          <summary>${esc(formatMonth(year, monthIndex))}<span>${count} FILE${count === 1 ? "" : "S"} • OPEN MONTH</span></summary>
          <div class="month-days">${dayHtml}</div>
        </details>`;
      }).join("");

    return `<section class="current-year-archive">
      <div class="archive-heading current-year-heading">${year} MONTH &amp; DAY ARCHIVE</div>
      ${monthHtml}
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
    if (document.getElementById("rolling-archive-style")) return;
    const style = document.createElement("style");
    style.id = "rolling-archive-style";
    style.textContent = `
      .rolling-window-title{border-top:7px double #111;border-bottom:2px solid #111;padding:8px 0 6px;margin:18px 0 0;display:flex;justify-content:space-between;align-items:flex-end;gap:18px}
      .rolling-window-title h2{font:900 34px/1 Georgia,serif;margin:0}.rolling-window-title span{font:900 11px/1.35 Arial,sans-serif;color:#c40000;letter-spacing:.08em;text-align:right}
      .current-news{width:100%;margin-bottom:30px}.current-columns{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:28px;width:100%;align-items:start}
      .current-column{min-width:0}.current-column+.current-column{border-left:1px solid #aaa;padding-left:24px}
      .current-year-archive,.historic-archive{display:block;width:100%;margin-top:24px}
      details.month-archive,details.day-archive,details.year-archive{display:block;width:100%;background:#fffdf7}
      details.month-archive{border-top:3px solid #111;margin:0 0 10px}
      details.month-archive>summary{cursor:pointer;list-style:none;padding:13px 4px;font:900 24px/1 Georgia,serif;display:flex;justify-content:space-between;gap:12px}
      details.month-archive>summary::-webkit-details-marker,details.day-archive>summary::-webkit-details-marker{display:none}
      details.month-archive>summary span,details.day-archive>summary span{font:900 10px Arial,sans-serif;color:#c40000;letter-spacing:.08em}
      details.month-archive[open]>summary{border-bottom:2px solid #111}
      .month-days{padding:4px 0 12px}
      details.day-archive{border-bottom:1px solid #aaa}
      details.day-archive>summary{cursor:pointer;list-style:none;padding:10px 10px;font:900 14px/1.2 Arial,sans-serif;display:flex;justify-content:space-between;gap:12px;background:#f4f0e7}
      details.day-archive[open]>summary{background:#111;color:#fff}details.day-archive[open]>summary span{color:#ffdf4d}
      .archive-day-grid,.archive-year-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;padding:8px 0 18px;width:100%}
      .archive-day-column,.archive-year-column{min-width:0}.archive-day-column+.archive-day-column,.archive-year-column+.archive-year-column{border-left:1px solid #bbb;padding-left:18px}
      .current-year-heading{color:#111}
      .story[data-desk]{--desk:#3f4650;border-top:4px solid var(--desk);padding-top:8px}
      .story[data-desk] h3 button{color:var(--desk);text-decoration-color:var(--desk)}
      .story[data-desk="War & Security"],.lead[data-desk="War & Security"]{--desk:#a30d16}
      .story[data-desk="Science & Space"],.lead[data-desk="Science & Space"]{--desk:#006b63}
      .story[data-desk="Technology & AI"],.lead[data-desk="Technology & AI"]{--desk:#5d2a91}
      .story[data-desk="Politics & Society"],.lead[data-desk="Politics & Society"]{--desk:#153e75}
      .story[data-desk="Business & Power"],.lead[data-desk="Business & Power"]{--desk:#8a4b08}
      .story[data-desk="Culture & Entertainment"],.lead[data-desk="Culture & Entertainment"]{--desk:#9b175c}
      .story[data-desk="Sports & Soft Power"],.lead[data-desk="Sports & Soft Power"]{--desk:#26723a}
      .story[data-desk="World News"],.lead[data-desk="World News"]{--desk:#364552}
      .lead[data-desk] h2 button{color:var(--desk)}
      #newsroomFilter button[data-newsroom-category="World News"]{border-color:#a30d16;color:#a30d16}
      #newsroomFilter button[data-newsroom-category="Politics & Society"]{border-color:#153e75;color:#153e75}
      #newsroomFilter button[data-newsroom-category="Technology & AI"]{border-color:#5d2a91;color:#5d2a91}
      #newsroomFilter button[data-newsroom-category="Science & Space"]{border-color:#006b63;color:#006b63}
      #newsroomFilter button[data-newsroom-category="Business & Power"]{border-color:#8a4b08;color:#8a4b08}
      #newsroomFilter button[data-newsroom-category="Culture & Entertainment"]{border-color:#9b175c;color:#9b175c}
      #newsroomFilter button[data-newsroom-category="Sports & Soft Power"]{border-color:#26723a;color:#26723a}
      #newsroomFilter button.active{background:#111!important;color:#fff!important;border-color:#111!important}
      @media(max-width:900px){
        .rolling-window-title{align-items:flex-start;flex-direction:column}.rolling-window-title h2{font-size:27px}.rolling-window-title span{text-align:left}
        .current-columns,.archive-day-grid,.archive-year-grid{grid-template-columns:1fr!important}
        .current-column+.current-column,.archive-day-column+.archive-day-column,.archive-year-column+.archive-year-column{border-left:0;padding-left:0}
      }
    `;
    document.head.appendChild(style);
  }

  function rollingRender() {
    const all = dedupeEvents(allEvents());
    const filtered = all.filter((event) => matches(event) && deskMatches(event));
    renderTopline(filtered);
    colorLead(filtered[0] || all[0]);

    const archive = document.getElementById("archive");
    if (!archive) return;
    if (!filtered.length) {
      archive.innerHTML = '<div class="empty">NO MATCHES. EVEN THE GROUP CHAT COULD NOT MANUFACTURE A CROSSTAB.</div>';
      bindOpeners();
      return;
    }

    const today = chicagoToday();
    const windowStart = addDays(today, -DAYS_BEFORE_TODAY);
    const currentYear = today.getUTCFullYear();
    const selectedYear = state.year === "all" ? null : Number(state.year);
    const showHistoricOnly = selectedYear && selectedYear < currentYear;
    let html = "";

    if (!showHistoricOnly) {
      const currentWindow = filtered.filter((event) => {
        const value = dateValue(event);
        return Number(event.year) === currentYear && value >= windowStart.getTime() && value <= today.getTime();
      });
      const leadId = filtered[0]?.id;
      const gridEvents = currentWindow.filter((event) => event.id !== leadId);
      const leadNote = currentWindow.some((event) => event.id === leadId) ? " • 1 FEATURED ABOVE" : "";
      html += `<section class="current-news">
        <div class="rolling-window-title">
          <h2>CURRENT FILES // ${esc(formatRange(windowStart, today))}</h2>
          <span>${currentWindow.length} FILE${currentWindow.length === 1 ? "" : "S"}${leadNote}</span>
        </div>
        ${gridEvents.length
          ? `<div class="current-columns">${balancedColumns(gridEvents, 3)}</div>`
          : '<div class="empty">NO ADDITIONAL CURRENT FILES. THE FEATURED FILE IS ABOVE.</div>'}
      </section>`;

      const currentYearArchive = filtered.filter((event) => {
        const value = dateValue(event);
        return Number(event.year) === currentYear && value < windowStart.getTime();
      });
      html += renderCurrentYearArchive(currentYearArchive, currentYear);
    }

    html += renderOlderYearArchive(filtered, currentYear, selectedYear);
    archive.innerHTML = html || '<div class="empty">NO ARCHIVED FILES MATCH THIS VIEW.</div>';
    bindOpeners();
  }

  injectStyles();
  if (typeof render === "function") render = rollingRender;
  setTimeout(() => {
    injectStyles();
    if (typeof render === "function") render();
  }, 0);
})();
