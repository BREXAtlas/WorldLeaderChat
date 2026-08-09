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

  const MONTH_INDEX = new Map([
    ["january", 0], ["february", 1], ["march", 2], ["april", 3],
    ["may", 4], ["june", 5], ["july", 6], ["august", 7],
    ["september", 8], ["october", 9], ["november", 10], ["december", 11]
  ]);

  function parseEventDate(event) {
    const machine = String(event?.eventDate || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (machine) {
      return new Date(Date.UTC(Number(machine[1]), Number(machine[2]) - 1, Number(machine[3])));
    }

    // The original built-in archive predates eventDate and stores dates such as
    // â€œJuly 24, 2026â€ or â€œJune 15â€“17, 2026â€. Use the first day of a displayed
    // range so those files participate in the rolling window and month/day archive.
    const display = String(event?.date || "").trim();
    const human = display.match(/^([A-Za-z]+)\s+(\d{1,2})(?:[â€“â€”-]\d{1,2})?,\s*(\d{4})$/);
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
      return `${month.format(start).toUpperCase()} ${start.getUTCDate()}â€“${end.getUTCDate()}, ${end.getUTCFullYear()}`;
    }
    const startText = `${month.format(start).toUpperCase()} ${start.getUTCDate()}${sameYear ? "" : `, ${start.getUTCFullYear()}`}`;
    const endText = `${month.format(end).toUpperCase()} ${end.getUTCDate()}, ${end.getUTCFullYear()}`;
    return `${startText}â€“${endText}`;
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
    const return 6
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
      const dayKey = isoDate(date);
      if (!days.has(dayKey)) days.set(dayKey, []);
      days.get(dayKey).push(event);
    }
    return months;
  }

  function renderCurrentYearArchive(events, year) {
    if (!events.length) return "";
    const months = groupCurrentYearArchive(events);
    const searchOpen = Boolean(state.query);
    const monthHTML = [...months.entries()]
      .sort(([a], [b]) => b - a)
      .map(([monthIndex, days]) => {
        const count = [...days.values()].reduce((total, list) => total + list.length, 0);
        const dayHTML = [...days.entries()]
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([dayKey, dayEvents]) => {
            const date = parseEventDate({ eventDate: dayKey });
            return `<details class="day-archive" ${searchOpen ? "open" : ""}>
              <summary>${esc(formatDay(date))}<span>${dayEvents.length} FILE${dayEvents.length === 1 ? "" : "S"}</span></summary>
              <div class="archive-day-grid">${balancedColumns(dayEvents, 3, "archive-day-column")}</div>
            </details>`;
          }).join("");
        return `<details class="month-archive" ${searchOpen ? "open" : ""}>
          <summary>${esc(formatMonth(year, monthIndex))}<span>${count} FILE${count === 1 ? "" : "S"} â€¢ OPEN MONTH</span></summary>
          <div class="month-days">${dayHTML}</div>
        </details>`;
      }).join("");

    return `<section class="current-year-archive">
      <div class="archive-heading current-year-heading">${year} MONTH &[\ÈVHTÒU‘OÙ]‚ˆ	Û[ÛSBˆÜÙXİ[Û˜ÂˆB‚ˆ[˜İ[Ûˆ™[™\“Û\–YX\\˜Ú]™J]™[Ëİ\œ™[YX\‹Ù[XİYYX\ŠHÂˆÛÛœİYX\œÈHË‹‹›™]ÈÙ]
]™[Ë›X\

]™[
HOˆ[X™\Š]™[YX\ŠJK™š[\Š
YX\ŠHOˆYX\ˆİ\œ™[YX\ŠJWBˆœÛÜ

KŠHOˆˆHJNÂˆÛÛœİYX\œÕÔÚİÈHÙ[XİYYX\ˆ	‰ˆÙ[XİYYX\ˆİ\œ™[YX\ˆÈÜÙ[XİYYX\—HˆYX\œÎÂˆYˆ
^YX\œÕÔÚİË›[™İ
H™]\›ˆˆÂ‚ˆÛÛœİ]Z[ÈHYX\œÕÔÚİË›X\

YX\ŠHOˆÂˆÛÛœİYX\‘]™[ÈH]™[Ë™š[\Š
]™[
HOˆ[X™\Š]™[YX\ŠHOOHYX\ŠNÂˆYˆ
^YX\‘]™[Ë›[™İ
H™]\›ˆˆÂˆÛÛœİÜ[ˆH›ÛÛX[ŠÙ[XİYYX\ˆOOHYX\ˆİ]Kœ]Y\JNÂˆ™]\›ˆ]Z[ÈÛ\ÜÏHYX\‹X\˜Ú]™Hˆ	ÛÜ[ˆÈ›Ü[ˆˆˆˆŸO‚ˆİ[[X\O‰ŞYX\ŸOÜ[‰ŞYX\‘]™[Ë›[™İH’SIŞYX\‘]™[Ë›[™İOOHHÈˆˆˆ”ÈŸH8 (ˆÔSˆQPTÜÜ[Üİ[[X\O‚ˆ]ˆÛ\ÜÏH˜\˜Ú]™K^YX\‹YÜšY‰Ø˜[[˜ÙYÛÛ[[œÊYX\‘]™[ËË˜\˜Ú]™K^YX\‹XÛÛ[[ˆŠ_OÙ]‚ˆÙ]Z[Ï˜ÂˆJKš›Ú[ŠˆŠNÂ‚ˆÛÛœİš\œİ\İÜšXÖYX\ˆHX]›Z[Š‹‹YX\œÕÔÚİÊNÂˆÛÛœİ\İ\İÜšXÖYX\ˆHX]›X^
‹‹YX\œÕÔÚİÊNÂˆÛÛœİ˜[™ÙHHš\œİ\İÜšXÖYX\ˆOOH\İ\İÜšXÖYX\ˆÈİš[™Êš\œİ\İÜšXÖYX\ŠHˆ	Ùš\œİ\İÜšXÖYX\Ÿx $ÉÛ\İ\İÜšXÖYX\ŸXÂˆ™]\›ˆÙXİ[ÛˆÛ\ÜÏHš\İÜšXËX\˜Ú]™H‚ˆ]ˆÛ\ÜÏH˜\˜Ú]™KZXY[™ÈTÒU‘HËÈ	Ü˜[™Ù_OÙ]‚ˆ	Ù]Z[ßBˆÜÙXİ[Û˜ÂˆB‚ˆ[˜İ[Ûˆ[š™Xİİ[\Ê
HÂˆYˆ
Øİ[Y[™Ù][[Y[RY
œ›Û[™ËX\˜Ú]™K\İ[HŠJH™]\›ÂˆÛÛœİİ[HHØİ[Y[˜Ü™X]Q[[Y[
œİ[HŠNÂˆİ[KšYHœ›Û[™ËX\˜Ú]™K\İ[HÂˆİ[K^ÛÛ[Hˆœ›Û[™Ë]Ú[™İË]]^Ø›Ü™\‹]ÜÜİX›HÌLLNØ›Ü™\‹X›İÛNŒœÛÛYÌLLNÜY[™ÎœÛX\™Ú[ŒNÙ\Ü^N™›^Ú\İYKXÛÛ[œÜXÙKX™]ÙY[Ø[YÛ‹Z][\Î™›^Y[™ÙØ\ŒNBˆœ›Û[™Ë]Ú[™İË]]HÙ›ÛLÍÌHÙ[Ü™ÚXKÙ\šYÛX\™Ú[ŒKœ›Û[™Ë]Ú[™İË]]HÜ[Ù›ÛLL\ÌKŒÍH\šX[Ø[œË\Ù\šYØÛÛÜˆØÍÛ]\‹\ÜXÚ[™Î‹Œ[Nİ^X[YÛœšYÚBˆ˜İ\œ™[[™]ÜÈİÚYŒL	NÛX\™Ú[‹X›İÛNŒÌK˜İ\œ™[XÛÛ[[œŞÙ\Ü^N™ÜšYÙÜšY][\]KXÛÛ[[œÎœ™\X]
ËZ[›X^
YœŠJNÙØ\ŒİÚYŒL	NØ[YÛ‹Z][\Îœİ\Bˆ˜İ\œ™[XÛÛ[[ÛZ[‹]ÚYŒK˜İ\œ™[XÛÛ[[ŠË˜İ\œ™[XÛÛ[[Ø›Ü™\‹[YŒ\ÛÛYØXXNÜY[™Ë[YŒBˆ˜İ\œ™[^YX\‹X\˜Ú]™Kš\İÜšXËX\˜Ú]™^Ù\Ü^N˜›ØÚÎİÚYŒL	NÛX\™Ú[‹]ÜŒBˆ]Z[Ë›[ÛX\˜Ú]™K]Z[Ë™^KX\˜Ú]™K]Z[ËYX\‹X\˜Ú]™^Ù\Ü^N˜›ØÚÎİÚYŒL	NØ˜XÚÙÜ›İ[™ˆÙ™™™ßBˆ]Z[Ë›[ÛX\˜Ú]™^Ø›Ü™\‹]ÜŒÜÛÛYÌLLNÛX\™Ú[ŒLBˆ]Z[Ë›[ÛX\˜Ú]™Oœİ[[X\^Øİ\œÛÜœÚ[\Û\İ\İ[N››Û™NÜY[™ÎŒLÜÙ›ÛLÌHÙ[Ü™ÚXKÙ\šYÙ\Ü^N™›^Ú\İYKXÛÛ[œÜXÙKX™]ÙY[ÙØ\ŒLœBˆ]Z[Ë›[ÛX\˜Ú]™Oœİ[[X\N‹]ÙXšÚ]Y]Z[Ë[X\šÙ\‹]Z[Ë™^KX\˜Ú]™Oœİ[[X\N‹]ÙXšÚ]Y]Z[Ë[X\šÙ\Ù\Ü^N››Û™_Bˆ]Z[Ë›[ÛX\˜Ú]™Oœİ[[X\HÜ[‹]Z[Ë™^KX\˜Ú]™Oœİ[[X\HÜ[Ù›ÛLL\šX[Ø[œË\Ù\šYØÛÛÜˆØÍÛ]\‹\ÜXÚ[™Î‹Œ[_Bˆ]Z[Ë›[ÛX\˜Ú]™VÛÜ[—Oœİ[[X\^Ø›Ü™\‹X›İÛNŒœÛÛYÌLL_Bˆ›[ÛY^\ŞÜY[™ÎLœBˆ]Z[Ë™^KX\˜Ú]™^Ø›Ü™\‹X›İÛNŒ\ÛÛYØXX_Bˆ]Z[Ë™^KX\˜Ú]™Oœİ[[X\^Øİ\œÛÜœÚ[\Û\İ\İ[N››Û™NÜY[™ÎŒLLÙ›ÛLMÌKŒˆ\šX[Ø[œË\Ù\šYÙ\Ü^N™›^Ú\İYKXÛÛ[œÜXÙKX™]ÙY[ÙØ\ŒLœØ˜XÚÙÜ›İ[™ˆÙŒMßBˆ]Z[Ë™^KX\˜Ú]™VÛÜ[—Oœİ[[X\^Ø˜XÚÙÜ›İ[™ˆÌLLNØÛÛÜˆÙ™™ŸY]Z[Ë™^KX\˜Ú]™VÛÜ[—Oœİ[[X\HÜ[ØÛÛÜˆÙ™™Bˆ˜\˜Ú]™KY^KYÜšY˜\˜Ú]™K^YX\‹YÜšYÙ\Ü^N™ÜšYÙÜšY][\]KXÛÛ[[œÎœ™\X]
ËZ[›X^
YœŠJNÙØ\ŒŒÜY[™ÎNİÚYŒL	_Bˆ˜\˜Ú]™KY^KXÛÛ[[‹˜\˜Ú]™K^YX\‹XÛÛ[[ÛZ[‹]ÚYŒK˜\˜Ú]™KY^KXÛÛ[[ŠË˜\˜Ú]™KY^KXÛÛ[[‹˜\˜Ú]™K^YX\‹XÛÛ[[ŠË˜\˜Ú]™K^YX\‹XÛÛ[[Ø›Ü™\‹[YŒ\ÛÛYØ˜˜ÜY[™Ë[YŒNBˆ˜İ\œ™[^YX\‹ZXY[™ŞØÛÛÜˆÌLL_BˆœİÜVÙ]KY\Ú×^ËKY\ÚÎˆÌÙLØ›Ü™\‹]ÜÛÛY˜\ŠKY\ÚÊNÜY[™Ë]ÜBˆœİÜVÙ]KY\Ú×H