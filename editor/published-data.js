"use strict";

(function useCanonicalPublishedDataInEditor() {
  if (typeof load !== "function") return;

  const issueFromPublishedEvent = (event) => ({
    number: Number(event?.editorial?.issueNumber || 0),
    title: event?.title || "Published World Leader Chat file",
    state: "closed",
    labels: [{ name: "news-candidate" }, { name: "published" }],
    publishedEvent: event,
    body: `${START}\n\`\`\`json\n${JSON.stringify({ schemaVersion: 1, status: "approved", event })}\n\`\`\`\n${END}`
  });

  load = async function loadCanonicalEditorialData() {
    const [open, response] = await Promise.all([
      api(`/repos/${OWNER}/${REPO}/issues?state=open&labels=news-candidate&per_page=100`),
      fetch(`../data/published-events.json?editor=${Date.now()}`, { cache: "no-store" })
    ]);
    if (!response.ok) throw new Error(`Could not load canonical published data (${response.status}).`);
    const publishedEvents = await response.json();
    issues = [
      ...open.filter((item) => !item.pull_request),
      ...publishedEvents.map(issueFromPublishedEvent)
    ];
    const available = new Set(issues.map(laneOf).filter(Boolean));
    if (!available.has(activeLane)) activeLane = ["ready", "drafting", "new", "published"].find((lane) => available.has(lane)) || "new";
    render();
  };

  // app.js may have loaded the old issue-backed Published lane before this
  // override executed. Refresh once so the tab reflects canonical site data.
  if (token && !document.querySelector("#workspace")?.hidden) load().catch((error) => notice(`Could not refresh published files: ${error.message}`, "error"));
})();
