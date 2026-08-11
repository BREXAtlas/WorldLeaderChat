"use strict";

(function polishWorldLeaderChatSite() {
  function applyLayout() {
    if (document.getElementById("newsroom-layout-fix")) return;

    const style = document.createElement("style");
    style.id = "newsroom-layout-fix";
    style.textContent = `
      /* The legacy archive container is a three-column grid. The newsroom renderer
         places whole sections inside it, so without this reset 2026, the archive
         heading and 2025 become three unrelated columns. */
      #archive.archive{
        display:block!important;
        grid-template-columns:none!important;
        gap:0!important;
        width:100%!important;
        max-width:none!important;
        padding-top:18px
      }
      #archive > .current-news,
      #archive > .archive-heading,
      #archive > details.year-archive{
        display:block!important;
        width:100%!important;
        max-width:none!important;
        grid-column:1/-1!important
      }
      #archive > .current-news{margin:0 0 30px}
      #archive > .archive-heading{margin:0 0 8px}
      #archive > details.year-archive{margin:0 0 8px}
      #archive > details.year-archive[open]{margin-bottom:22px}
      .current-columns,.archive-year-grid{width:100%;max-width:none}
      @media(min-width:901px){
        .current-columns,.archive-year-grid{
          grid-template-columns:repeat(3,minmax(0,1fr))!important
        }
      }
      @media(max-width:900px){
        .current-columns,.archive-year-grid{
          grid-template-columns:1fr!important
        }
      }
    `;
    document.head.appendChild(style);
  }

  function apply() {
    applyLayout();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", apply, { once: true });
  } else {
    apply();
  }

  // newsroom-site.js updates the DOM after its async bootstrap. Reapply the stable
  // site-level presentation rules after that render without changing any stories.
  setTimeout(apply, 0);
})();
