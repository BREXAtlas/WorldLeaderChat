"use strict";

(function installWorldLeaderChatEditorPresentation() {
  // Articles and chats are drafted, checked for article fit and stored in GitHub
  // before they reach this page. This script only supplies presentation styles;
  // it never manufactures or rewrites dialogue in the browser.
  if (document.getElementById("newsroom-editor-style")) return;
  const style = document.createElement("style");
  style.id = "newsroom-editor-style";
  style.textContent = `
    .article-preview{background:#f7f2e8;border:1px solid #cfc5b4;padding:10px;margin:10px 0;font:13px/1.45 Georgia,serif}
    .article-preview b{display:block;font-family:Arial,sans-serif;font-size:10px;letter-spacing:.1em;color:#9a3412;margin-bottom:5px}
    .article-preview strong{display:block;font-size:18px;line-height:1.2;margin-bottom:4px}
    .article-preview p{margin:0}
    .card .chat{max-height:520px;overflow:auto}
  `;
  document.head.appendChild(style);
})();
