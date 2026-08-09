"use strict";

(function polishWorldLeaderChatDisclosure() {
  function apply() {
    const footer = document.querySelector("footer");
    if (footer) {
      footer.innerHTML = "<strong>POLITICAL PARODY, NOT LEAKED CORRESPONDENCE.</strong><br>No private message on this page is authentic. Public-record excerpts are brief, visibly labeled and paired with source links.";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", apply, { once: true });
  } else {
    apply();
  }

  // newsroom-site.js may update presentation copy after its async bootstrap.
  setTimeout(apply, 0);
})();
