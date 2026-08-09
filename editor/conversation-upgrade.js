"use strict";

(function upgradeWorldLeaderChatDraftLength() {
  if (typeof fallbackSuggestion !== "function") return;

  const originalFallbackSuggestion = fallbackSuggestion;

  function additionsFor(bundle) {
    const text = `${bundle?.event?.title || ""} ${bundle?.event?.summary || ""}`.toLowerCase();
    const gaza = /gaza|netanyahu|hamas/.test(text);
    const ukraine = /ukraine|zelensky|kyiv|russia|serbia/.test(text);
    const iran = /iran|hormuz|nuclear|tehran/.test(text);
    const vance = /vance/.test(text);
    const china = /china|consulate|xi/.test(text);

    if (gaza) return [
      ["Trump", "Okay, but if point sixteen is just ‘no,’ I want credit for getting us to sixteen points.", "satire"],
      ["Netanyahu", "You may have the numbering. I am keeping the conditions.", "satire"],
      ["Macron", "This is not what diplomats mean when they ask the parties to narrow their differences.", "satire"],
      ["Meloni", "At this rate the appendix will need its own ceasefire.", "satire"],
      ["Trump", "We can rename it the seventeen-point plan. Seventeen is a very successful number.", "satire"],
      ["Xi", "China recommends agreeing on the document before increasing the page count.", "satire"]
    ];

    if (ukraine) return [
      ["Zelenskyy", "I asked for security commitments, not another seminar on strategic ambiguity.", "satire"],
      ["Putin", "Ambiguity is only strategic when your side is doing it.", "satire"],
      ["Meloni", "Wonderful. We have reached the part of the meeting where everyone defines the same word differently.", "satire"],
      ["Trump", "I still think the problem is the admins. Give me admin rights for twenty-four hours.", "satire"],
      ["Zelenskyy", "That sentence did not make me feel more secure.", "satire"],
      ["Xi", "The group has noted your concern without resolving any part of it.", "satire"]
    ];

    if (iran && vance) return [
      ["Iran", "If the program is gone, why is everyone still holding emergency meetings about the program?", "satire"],
      ["Vance", "Because verification takes longer than the headline.", "satire"],
      ["Trump", "The headline was excellent. Very efficient headline.", "satire"],
      ["Macron", "Unfortunately, centrifuges have never accepted a headline as an inspection report.", "satire"],
      ["Iran", "Please continue debating our facilities in the third person while we remain in the chat.", "satire"],
      ["UN Admin", "The word ‘destroyed’ has been temporarily muted pending verification.", "system"]
    ];

    if (iran) return [
      ["Iran", "You called the last warning final too. We have screenshots.", "satire"],
      ["Trump", "That was final at the time. This is final now.", "satire"],
      ["Macron", "Diplomacy has discovered a previously unknown number of finales.", "satire"],
      ["Putin", "A red line is most flexible when everyone claims theirs is permanent.", "satire"],
      ["Trump", "Nobody has more permanent red lines than me.", "satire"],
      ["Xi", "The typing continues. The agreement remains shorter than the argument.", "satire"]
    ];

    if (china) return [
      ["Trump", "Nobody is giving China our desks. We are simply not using the desks.", "satire"],
      ["Xi", "That distinction is extremely convenient for the person interested in the desks.", "satire"],
      ["Macron", "Diplomatic influence is not furniture, although apparently we are testing the theory.", "satire"],
      ["Meloni", "Please tell me nobody put ‘soft power’ on Facebook Marketplace.", "satire"],
      ["Trump", "If we did, we would get a fantastic price.", "satire"],
      ["Xi", "China has saved the listing.", "satire"]
    ];

    return [
      ["Trump", "I would like the record to show my first message was still the strongest message.", "satire"],
      ["Macron", "The record has asked not to be involved.", "satire"],
      ["Meloni", "Can we discuss the actual event before someone changes the group name again?", "satire"],
      ["Trump", "Fine. But the group name needs work.", "satire"],
      ["Xi", "China supports returning to the agenda. China also predicts this will not happen.", "satire"],
      ["UN Admin", "Agenda restored. Confidence in agenda: low.", "system"]
    ];
  }

  fallbackSuggestion = function longerFallbackSuggestion(bundle, version = 0) {
    const result = originalFallbackSuggestion(bundle, version);
    if (!result?.event?.messages) return result;

    const additions = additionsFor(result).map(([speaker, text, kind]) => ({
      speaker,
      text,
      kind,
      reaction: ""
    }));

    result.event.messages = [...result.event.messages, ...additions];
    result.approval = {
      ...(result.approval || {}),
      conversationStyle: "back-and-forth",
      targetMessageCount: "10-14"
    };
    return result;
  };

  function needsConversationUpgrade(bundle) {
    return Boolean(bundle?.event?.messages) && bundle.event.messages.length < 10;
  }

  function upgradedBundle(bundle) {
    if (!needsConversationUpgrade(bundle)) return bundle;
    const version = Number(bundle.approval?.draftVersion || 0);
    return fallbackSuggestion(bundle, version);
  }

  if (typeof render === "function") {
    const originalRender = render;
    render = function renderWithLongerDrafts() {
      for (const issue of issues || []) {
        const labels = labelSet(issue);
        if (issue.state === "closed" || labels.has("published") || labels.has("editorial-approved")) continue;
        const bundle = parseBundle(issue.body || "");
        if (!needsConversationUpgrade(bundle)) continue;
        issue.body = replaceBundle(issue.body || "", upgradedBundle(bundle));
      }
      return originalRender();
    };
  }

  if (typeof act === "function") {
    const originalAct = act;
    act = async function actWithLongerDraft(action, number) {
      if ((action === "approve" || action === "regenerate") && !busy.has(number)) {
        const currentIssue = await api(`/repos/${OWNER}/${REPO}/issues/${number}`);
        const labels = labelSet(currentIssue);
        if (currentIssue.state !== "closed" && !labels.has("published") && !labels.has("editorial-approved")) {
          const bundle = parseBundle(currentIssue.body || "");
          if (needsConversationUpgrade(bundle)) {
            const longer = upgradedBundle(bundle);
            const body = replaceBundle(currentIssue.body || "", longer);
            await api(`/repos/${OWNER}/${REPO}/issues/${number}`, {
              method: "PATCH",
              body: JSON.stringify({ body })
            });
            const localIssue = issues.find((item) => item.number === number);
            if (localIssue) localIssue.body = body;
          }
        }
      }
      return originalAct(action, number);
    };
  }
})();
