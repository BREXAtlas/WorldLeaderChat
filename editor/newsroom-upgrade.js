"use strict";

(function installWorldLeaderChatNewsroomEditor() {
  if (typeof fallbackSuggestion !== "function") return;

  const originalFallbackSuggestion = fallbackSuggestion;
  const metaNarration = /\b(imagined|hypothetical|would likely|would probably|plausible reaction|reaction consistent|response imagined|posture|take:|style response|public-figure|would note|would stress|would frame|would urge|would point to|voice would)\b/i;
  const genericSpeaker = /^(world leader|u\.?s\.? official|american official|european diplomat|government official|public figure|political observer|analyst)$/i;

  function cleanSummary(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .replace(/\bContinue reading\.?$/i, "")
      .replace(/\bFollow [A-Z][A-Za-z .'-]+ for more\.?$/i, "")
      .trim();
  }

  function articleAngle(bundle) {
    const text = `${bundle?.event?.title || ""} ${bundle?.event?.summary || ""}`.toLowerCase();
    if (/gaza|netanyahu|hamas/.test(text)) return "The proposal and the rejection are real. The sharper angle is how quickly a numbered plan becomes a shared document where every participant has edit access.";
    if (/ukraine|zelensky|kyiv|russia|putin/.test(text)) return "The security stakes are real. The dry subtext is that every capital supports clarity right up until clarity asks for a commitment.";
    if (/iran|hormuz|tehran|nuclear/.test(text)) return "The underlying development is serious. The sarcasm belongs in the familiar choreography: warnings called final, talks called possible and everyone saving screenshots.";
    if (/rocket|spacex|blue origin|nasa|moon|mars/.test(text)) return "The launch is the news. The subtext is that national prestige, private capital and billionaire rivalry rarely stay in separate group chats for long.";
    if (/artificial intelligence|\bai\b|openai|sam altman|chip/.test(text)) return "The technology is real and consequential. The comedy is watching founders, regulators and governments all claim they are the responsible adult in the room.";
    if (/taylor swift|larry david|obama|music|song|film|hbo|copyright/.test(text)) return "The cultural event is real. The political edge comes from how quickly a song, suit or television joke can turn into a national communications strategy.";
    if (/immigration|deportation|border|poll|midterm/.test(text)) return "The numbers and policy dispute are real. The dry joke is that every faction can find one line that sounds like the country finally agreed with it.";
    return "The event is reported straight. The edge comes from translating the public choreography into the subtext readers can already see.";
  }

  function addArticle(bundle) {
    const result = structuredClone(bundle);
    const summary = cleanSummary(result.event?.summary);
    const angle = articleAngle(result);
    const publishers = [...new Set((result.event?.sources || []).map((source) => source.publisher).filter(Boolean))];
    result.ingestion = {...(result.ingestion || {}), newsroomFormat: 2};
    result.event.summary = summary;
    result.event.article = {
      headline: result.event.title,
      dek: angle,
      body: [
        summary,
        "The original reporting points to one factual conclusion. This version keeps that conclusion intact and leaves the public choreography visible: who is claiming credit, who is objecting and which part of the official language is doing the most work.",
        angle,
        "The conversation below is the imagined off-mic layer. It exaggerates recognizable reactions and rivalries, but it does not change the event, outcome or source record."
      ],
      sourceCredit: `Based on original reporting from ${publishers.join(", ") || "the linked publisher"}. Open the source links for the full reporting.`
    };
    result.approval = {
      ...(result.approval || {}),
      articleStyle: "truth-first-sarcastic-news",
      conversationStyle: "back-and-forth",
      targetMessageCount: "10-14"
    };
    result.factCheck = {...(result.factCheck || {}), articleMatchesSources: false};
    return result;
  }

  function dialogueNeedsUpgrade(messages) {
    if (!Array.isArray(messages) || messages.length < 10 || messages.length > 14) return true;
    if (messages.some((message) => metaNarration.test(String(message?.text || "")))) return true;
    if (messages.some((message) => genericSpeaker.test(String(message?.speaker || "").trim()))) return true;
    const counts = new Map();
    for (const message of messages) {
      if (!message || message.kind === "system") continue;
      const speaker = String(message.speaker || "").trim();
      counts.set(speaker, (counts.get(speaker) || 0) + 1);
    }
    return [...counts.values()].filter((count) => count >= 2).length < 2;
  }

  function ensureNewsroom(bundle, version = 0) {
    if (!bundle) return null;
    let result = bundle;
    const incomplete = JSON.stringify(result).includes("[EDITOR:") || dialogueNeedsUpgrade(result.event?.messages || []);
    if (incomplete) result = originalFallbackSuggestion(result, version);
    if (!result.event?.article?.body || result.event.article.body.length < 2) result = addArticle(result);
    result.ingestion = {...(result.ingestion || {}), newsroomFormat: 2};
    result.approval = {
      ...(result.approval || {}),
      conversationStyle: "direct-back-and-forth",
      dialogueQuality: "first-person direct dialogue; no meta narration",
      targetMessageCount: "10-14"
    };
    return result;
  }

  fallbackSuggestion = function newsroomFallbackSuggestion(bundle, version = 0) {
    return ensureNewsroom(originalFallbackSuggestion(bundle, version), version);
  };

  function decorateCards() {
    const styleId = "newsroom-editor-style";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = ".article-preview{background:#f7f2e8;border:1px solid #cfc5b4;padding:10px;margin:10px 0;font:13px/1.45 Georgia,serif}.article-preview b{display:block;font-family:Arial,sans-serif;font-size:10px;letter-spacing:.1em;color:#9a3412;margin-bottom:5px}.article-preview p{margin:0}.card .chat{max-height:520px;overflow:auto}";
      document.head.appendChild(style);
    }

    document.querySelectorAll(".card").forEach((card) => {
      if (card.querySelector(".article-preview")) return;
      const issueNumber = Number(card.querySelector(".meta")?.textContent.match(/#(\d+)/)?.[1]);
      const issue = issues.find((item) => item.number === issueNumber);
      if (!issue) return;
      const bundle = ensureNewsroom(parseBundle(issue.body || ""), 0);
      const article = bundle?.event?.article;
      if (!article) return;
      const preview = document.createElement("div");
      preview.className = "article-preview";
      preview.innerHTML = `<b>SHORT ARTICLE PREVIEW</b><strong>${esc(article.headline)}</strong><p>${esc(article.dek)}</p>`;
      const chat = card.querySelector(".chat");
      if (chat) card.insertBefore(preview, chat);
    });
  }

  if (typeof render === "function") {
    const originalRender = render;
    render = function renderNewsroomCards() {
      const output = originalRender();
      decorateCards();
      return output;
    };
  }

  if (typeof act === "function") {
    const originalAct = act;
    act = async function actNewsroom(action, number) {
      if ((action === "approve" || action === "regenerate") && !busy.has(number)) {
        const issue = await api(`/repos/${OWNER}/${REPO}/issues/${number}`);
        const labels = labelSet(issue);
        if (issue.state !== "closed" && !labels.has("published") && !labels.has("editorial-approved")) {
          const existing = parseBundle(issue.body || "");
          const version = Number(existing?.approval?.draftVersion || 0) + (action === "regenerate" ? 1 : 0);
          const upgraded = ensureNewsroom(existing, version);
          if (upgraded) {
            if (action === "approve") upgraded.factCheck.articleMatchesSources = true;
            const body = replaceBundle(issue.body || "", upgraded);
            await api(`/repos/${OWNER}/${REPO}/issues/${number}`, {
              method: "PATCH",
              body: JSON.stringify({body})
            });
            const local = issues.find((item) => item.number === number);
            if (local) local.body = body;
          }
        }
      }
      return originalAct(action, number);
    };
  }
})();
