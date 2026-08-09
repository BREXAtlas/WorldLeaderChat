"use strict";

(function installWorldLeaderChatSocialTools() {
  function currentEvent() {
    try {
      const match = location.hash.match(/event=([^&]+)/);
      const id = (typeof state !== "undefined" && state.currentId) || (match ? decodeURIComponent(match[1]) : null);
      return id && typeof allEvents === "function" ? allEvents().find((event) => event.id === id) : null;
    } catch {
      return null;
    }
  }

  function transcriptText(event) {
    const lines = [
      "WORLD LEADER CHAT — FICTIONAL SATIRE",
      event.title,
      `${event.date} • ${event.category}`,
      "",
      "PRIVATE CHAT BELOW IS INVENTED. PUBLIC-RECORD LINES ARE LABELED.",
      ""
    ];

    for (const message of event.messages || []) {
      if (message.kind === "system") {
        lines.push(`[SYSTEM] ${message.text}`);
      } else if (message.kind === "public") {
        lines.push(`${message.speaker} [PUBLIC RECORD]: ${message.text}`);
      } else {
        lines.push(`${message.speaker}: ${message.text}`);
      }
      if (message.reaction) lines.push(`  ↳ ${message.reaction}`);
      lines.push("");
    }

    if (event.meme) lines.push(`MEME LINE: ${event.meme}`, "");
    const publishers = [...new Set((event.sources || []).map((source) => source.publisher).filter(Boolean))];
    if (publishers.length) lines.push(`REAL-EVENT SOURCES: ${publishers.join(", ")}`);
    lines.push(`READ THE FILE: ${location.origin}${location.pathname}#event=${encodeURIComponent(event.id)}`);
    return lines.join("\n").trim();
  }

  function socialText(event) {
    const messages = (event.messages || []).filter((message) => message.kind !== "system");
    const lines = [
      "WORLD LEADER CHAT — FICTIONAL SATIRE",
      event.title,
      "",
      ...messages.flatMap((message) => [
        `${message.speaker}${message.kind === "public" ? " [PUBLIC RECORD]" : ""}: ${message.text}`,
        ""
      ]),
      event.meme ? `💬 ${event.meme}` : "",
      "",
      `Real event + sources: ${location.origin}${location.pathname}#event=${encodeURIComponent(event.id)}`
    ];
    return lines.filter((line, index, array) => line || array[index - 1] !== "").join("\n").trim();
  }

  async function copyValue(text, button, successLabel) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }

    const previous = button.textContent;
    button.textContent = successLabel;
    button.disabled = true;
    setTimeout(() => {
      button.textContent = previous;
      button.disabled = false;
    }, 1300);
  }

  function addButtons() {
    const actions = document.querySelector(".detail-actions");
    if (!actions || document.querySelector("#copyChatBtn")) return;

    const copyChat = document.createElement("button");
    copyChat.className = "btn red";
    copyChat.id = "copyChatBtn";
    copyChat.type = "button";
    copyChat.textContent = "Copy Full Chat";
    copyChat.addEventListener("click", () => {
      const event = currentEvent();
      if (event) copyValue(transcriptText(event), copyChat, "Chat Copied ✓");
    });

    const copySocial = document.createElement("button");
    copySocial.className = "btn";
    copySocial.id = "copySocialBtn";
    copySocial.type = "button";
    copySocial.textContent = "Copy Social Version";
    copySocial.addEventListener("click", () => {
      const event = currentEvent();
      if (event) copyValue(socialText(event), copySocial, "Social Copy Ready ✓");
    });

    actions.append(copyChat, copySocial);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", addButtons, { once: true });
  } else {
    addButtons();
  }
})();
