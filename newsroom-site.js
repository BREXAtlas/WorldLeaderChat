"use strict";

(function installWorldLeaderChatNewsroom() {
  const newsroom = { category: "all" };

  function sectionFor(event) {
    if (globalThis.WLC_NEWSROOM) return globalThis.WLC_NEWSROOM.sectionFor(event);
    const text = `${event.category || ""} ${event.title || ""} ${event.summary || ""}`.toLowerCase();
    if (/technology|artificial intelligence|\bai\b|cyber|tiktok|openai|chip|semiconductor/.test(text)) return "Technology & AI";
    if (/science|space|rocket|nasa|spacex|moon|mars|telescope|discovery/.test(text)) return "Science & Space";
    if (/business|economy|trade|tariff|market|company|billionaire|antitrust/.test(text)) return "Business & Power";
    if (/culture|entertainment|music|song|album|film|movie|television|hbo|copyright|taylor swift|larry david/.test(text)) return "Culture & Entertainment";
    if (/sports|olympics|world cup|championship|medal|fifa/.test(text)) return "Sports & Soft Power";
    if (/election|congress|court|immigration|border|protest|civil rights|health|society/.test(text)) return "Politics & Society";
    if (/war|security|diplomacy|alliance|world affairs|breaking|iran|ukraine|russia|china|israel|gaza/.test(text)) return "World News";
    return "World News";
  }

  function injectStyles() {
    if (document.getElementById("newsroom-site-style")) return;
    const style = document.createElement("style");
    style.id = "newsroom-site-style";
    style.textContent = `
      #deskJump,.update-desk{display:none!important}
      .newsroom-filter{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;padding:10px 0;border-bottom:2px solid #111}
      .newsroom-filter button{border:1px solid #111;background:#fff;padding:7px 9px;font:900 11px Arial,sans-serif;text-transform:uppercase;cursor:pointer}
      .newsroom-filter button.active,.newsroom-filter button:hover{background:#111;color:#fff}
      .current-news-title{border-top:7px double #111;border-bottom:2px solid #111;padding:8px 0 5px;margin:18px 0 0;display:flex;justify-content:space-between;align-items:baseline}
      .current-news-title h2{font:900 34px/1 Georgia,serif;margin:0}.current-news-title span{font:900 11px Arial,sans-serif;color:#c40000;letter-spacing:.09em}
      .current-columns{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:28px;align-items:start}
      .current-column{min-width:0}.current-column+.current-column{border-left:1px solid #aaa;padding-left:24px}
      .archive-heading{margin:28px 0 8px;border-top:7px double #111;padding-top:8px;font:900 26px Georgia,serif}
      details.year-archive{border-top:2px solid #111;margin:0;background:#fffdf7}
      details.year-archive summary{cursor:pointer;list-style:none;padding:13px 4px;font:900 23px/1 Georgia,serif;display:flex;justify-content:space-between;gap:12px}
      details.year-archive summary::-webkit-details-marker{display:none}
      details.year-archive summary span{font:900 10px Arial,sans-serif;color:#c40000;letter-spacing:.08em}
      details.year-archive[open] summary{border-bottom:1px solid #777}
      .archive-year-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;padding:4px 0 18px}
      .archive-year-grid .story{padding-left:3px;padding-right:3px}
      .article-report{border-top:5px double #111;border-bottom:1px solid #aaa;margin:14px 0;padding:12px 0}
      .article-report .article-label{font:900 10px Arial,sans-serif;letter-spacing:.13em;color:#c40000;text-transform:uppercase}
      .article-report h3{font:900 26px/1 Georgia,serif;margin:5px 0 7px}
      .article-report .dek{font:700 16px/1.28 Georgia,serif;margin:0 0 11px}
      .article-report p{font:15px/1.52 Georgia,serif;margin:0 0 11px}
      .article-report .credit{font:700 11px/1.4 Arial,sans-serif;color:#555;border-left:4px solid #c40000;padding-left:8px}
      @media(max-width:900px){.current-columns,.archive-year-grid{grid-template-columns:1fr}.current-column+.current-column{border-left:0;padding-left:0}.current-news-title h2{font-size:27px}}
    `;
    document.head.appendChild(style);
  }

  function updateSideboxLanguage() {
    const sidebox = document.querySelector(".sidebox");
    if (!sidebox) return;
    const title = sidebox.querySelector("h3");
    if (title) title.textContent = "HOW TO READ THE FILE";
    const intro = sidebox.querySelector("p");
    if (intro) intro.textContent = "The front page carries the urgency of an old-school link newspaper. Open a headline for the sourced short report and the imagined off-mic conversation.";
    const fiction = sidebox.querySelector(".legend .fiction");
    const record = sidebox.querySelector(".legend .record");
    const system = sidebox.querySelector(".legend .sys");
    if (fiction) fiction.textContent = "GREEN = PRIVATE REACTION";
    if (record) record.textContent = "YELLOW = PUBLIC RECORD";
    if (system) system.textContent = "GRAY = CHAT NOTE";
  }

  function updatePublicLanguage() {
    const strip = document.querySelector(".satire-strip");
    if (strip) strip.innerHTML = "<b>WORLD LEADER CHAT</b> • REAL EVENTS • ORIGINAL SOURCES • IMAGINED PRIVATE REACTIONS";
    const note = document.querySelector(".mast-note");
    if (note) note.textContent = "The day’s real headlines, rewritten with a sharper edge. Open any file for the short report, the original sources and the conversation the room might have sounded like.";
    const dialogHead = document.querySelector(".dialog-head b");
    if (dialogHead) dialogHead.textContent = "WORLD LEADER CHAT // THE FILE";
    const chatNote = document.querySelector(".chat-top p");
    if (chatNote) chatNote.textContent = "Sourced event • imagined off-mic reactions • public-record excerpts labeled";
    updateSideboxLanguage();
  }

  function buildCategoryFilter() {
    let nav = document.getElementById("newsroomFilter");
    if (!nav) {
      nav = document.createElement("nav");
      nav.id = "newsroomFilter";
      nav.className = "newsroom-filter";
      nav.setAttribute("aria-label", "Filter by news desk");
      document.getElementById("yearbar")?.insertAdjacentElement("afterend", nav);
    }
    const categories = ["all", ...(globalThis.WLC_NEWSROOM?.desks || ["War & Security", "World News", "Politics & Society", "Technology & AI", "Science & Space", "Business & Power", "Culture & Entertainment", "Sports & Soft Power"])];
    nav.innerHTML = categories.map((category) => `<button type="button" data-newsroom-category="${esc(category)}" class="${newsroom.category === category ? "active" : ""}">${category === "all" ? "All Desks" : esc(category)}</button>`).join("");
    nav.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        newsroom.category = button.dataset.newsroomCategory;
        buildCategoryFilter();
        render();
      });
    });
  }

  function newsroomMatches(event) {
    return newsroom.category === "all" || sectionFor(event) === newsroom.category;
  }

  function labeledStory(event) {
    const html = storyHTML(event);
    return html.replace('<div class="tag">', `<div class="tag" data-section="${esc(sectionFor(event))}">`);
  }

  function columns(events, count = 3) {
    const buckets = Array.from({length: count}, () => []);
    events.forEach((event, index) => buckets[index % count].push(event));
    return buckets.map((bucket) => `<div class="current-column">${bucket.map(labeledStory).join("")}</div>`).join("");
  }

  function customRender() {
    const filtered = allEvents().filter((event) => matches(event) && newsroomMatches(event));
    renderTopline(filtered);
    updateSideboxLanguage();
    const archive = document.getElementById("archive");
    if (!archive) return;
    if (!filtered.length) {
      archive.innerHTML = '<div class="empty">NO MATCHES. EVEN THE GROUP CHAT COULD NOT MANUFACTURE A CROSSTAB.</div>';
      bindOpeners();
      return;
    }

    const selectedYear = state.year === "all" ? null : Number(state.year);
    const currentYear = 2026;
    const current = filtered.filter((event) => Number(event.year) === currentYear && (!selectedYear || selectedYear === currentYear));
    const olderYears = [...new Set(filtered.filter((event) => Number(event.year) < currentYear).map((event) => Number(event.year)))].sort((a,b) => b-a);
    const showArchiveOnly = selectedYear && selectedYear < currentYear;

    let html = "";
    if (!showArchiveOnly) {
      html += `<section class="current-news"><div class="current-news-title"><h2>2026 // CURRENT FILES</h2><span>${current.length} HEADLINE${current.length === 1 ? "" : "S"}</span></div>${current.length ? `<div class="current-columns">${columns(current, 3)}</div>` : '<div class="empty">NO 2026 FILES MATCH THIS FILTER.</div>'}</section>`;
    }

    const yearsToShow = selectedYear && selectedYear < currentYear ? [selectedYear] : olderYears;
    if (yearsToShow.length) {
      html += '<div class="archive-heading">ARCHIVE // 2020–2025</div>';
      for (const year of yearsToShow) {
        const events = filtered.filter((event) => Number(event.year) === year);
        if (!events.length) continue;
        const shouldOpen = Boolean(selectedYear === year || state.query);
        html += `<details class="year-archive" ${shouldOpen ? "open" : ""}><summary>${year}<span>${events.length} FILE${events.length === 1 ? "" : "S"} • OPEN ARCHIVE</span></summary><div class="archive-year-grid">${columns(events, 3)}</div></details>`;
      }
    }

    archive.innerHTML = html;
    bindOpeners();
  }

  function ensureArticlePanel() {
    let panel = document.getElementById("dialogArticle");
    if (panel) return panel;
    panel = document.createElement("section");
    panel.id = "dialogArticle";
    panel.className = "article-report";
    const summary = document.getElementById("dialogSummary");
    summary?.insertAdjacentElement("beforebegin", panel);
    return panel;
  }

  function renderArticle(event) {
    const panel = ensureArticlePanel();
    const article = event.article && Array.isArray(event.article.body)
      ? event.article
      : {
          headline: event.title,
          dek: event.kicker,
          body: [event.summary],
          sourceCredit: `Original reporting credited below to ${(event.sources || []).map((source) => source.publisher).filter(Boolean).join(", ")}.`
        };
    const label = event.article ? "THE SHORT REPORT" : "NEWS BRIEF";
    panel.innerHTML = `<div class="article-label">${label}</div><h3>${esc(article.headline || event.title)}</h3><div class="dek">${esc(article.dek || event.kicker)}</div>${(article.body || []).map((paragraph) => `<p>${esc(paragraph)}</p>`).join("")}<div class="credit">${esc(article.sourceCredit || "Original sources linked below.")}</div>`;
    const summary = document.getElementById("dialogSummary");
    if (summary) summary.hidden = true;
  }

  function installBubbleLanguage() {
    if (typeof bubbleHTML !== "function") return;
    const originalBubble = bubbleHTML;
    bubbleHTML = function newsroomBubble(message, index) {
      const html = originalBubble(message, index);
      return message.kind === "satire"
        ? html.replace('<span class="label">FICTIONAL SATIRE</span>', "")
        : html;
    };
  }

  injectStyles();
  updatePublicLanguage();
  buildCategoryFilter();
  installBubbleLanguage();

  if (typeof render === "function") render = customRender;
  if (typeof openEvent === "function") {
    const originalOpenEvent = openEvent;
    openEvent = function openNewsroomEvent(id, pushHash = true) {
      const result = originalOpenEvent(id, pushHash);
      const event = allEvents().find((item) => item.id === id);
      if (event) renderArticle(event);
      return result;
    };
  }

  setTimeout(() => {
    updatePublicLanguage();
    buildCategoryFilter();
    if (typeof render === "function") render();
  }, 0);
})();
