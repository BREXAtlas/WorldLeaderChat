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

  function sourcePublishers(event) {
    return [...new Set((event.sources || []).map((source) => source.publisher).filter(Boolean))];
  }

  function eventUrl(event) {
    return `${location.origin}${location.pathname}#event=${encodeURIComponent(event.id)}`;
  }

  function transcriptText(event) {
    const article = event.article;
    const lines = [
      "WORLD LEADER CHAT",
      event.title,
      `${event.date} • ${event.category}`,
      "",
      "REAL EVENT. ORIGINAL SOURCES LINKED. PRIVATE REACTIONS IMAGINED.",
      ""
    ];

    if (article?.body?.length) {
      lines.push("THE SHORT REPORT", article.headline || event.title, article.dek || "", "");
      for (const paragraph of article.body) lines.push(paragraph, "");
    }

    lines.push("THE CHAT", "");
    for (const message of event.messages || []) {
      if (message.kind === "system") {
        lines.push(`[CHAT NOTE] ${message.text}`);
      } else if (message.kind === "public") {
        lines.push(`${message.speaker} [PUBLIC RECORD]: ${message.text}`);
      } else {
        lines.push(`${message.speaker}: ${message.text}`);
      }
      if (message.reaction) lines.push(`  ↳ ${message.reaction}`);
      lines.push("");
    }

    if (event.meme) lines.push(`LAST WORD: ${event.meme}`, "");
    const publishers = sourcePublishers(event);
    if (publishers.length) lines.push(`ORIGINAL REPORTING: ${publishers.join(", ")}`);
    lines.push(`READ THE FILE + SOURCES: ${eventUrl(event)}`);
    return lines.join("\n").trim();
  }

  function socialText(event) {
    const messages = (event.messages || []).filter((message) => message.kind !== "system");
    const lines = [
      "WORLD LEADER CHAT",
      event.title,
      "",
      event.article?.dek || event.kicker || "",
      "",
      ...messages.flatMap((message) => [
        `${message.speaker}${message.kind === "public" ? " [PUBLIC RECORD]" : ""}: ${message.text}`,
        ""
      ]),
      event.meme ? `💬 ${event.meme}` : "",
      "",
      `Real event + original sources: ${eventUrl(event)}`
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
    copyChat.textContent = "Copy Article + Chat";
    copyChat.addEventListener("click", () => {
      const event = currentEvent();
      if (event) copyValue(transcriptText(event), copyChat, "File Copied ✓");
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
