"use strict";

(function declareWorldLeaderChatConversationStandard() {
  // Conversations are now written and quality-checked on the server. The editor
  // deliberately does not append stock replies in the browser, because that made
  // unrelated articles share the same dialogue.
  window.WLC_CHAT_STANDARD = Object.freeze({
    targetMessageCount: "10-14",
    style: "article-specific direct back-and-forth",
    browserGeneratedDialogue: false
  });
})();
