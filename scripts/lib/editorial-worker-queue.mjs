import { extractStoryBundle } from "./editorial.mjs";

export function labelsOf(issue) {
  return new Set((issue?.labels || []).map((label) => typeof label === "string" ? label : label.name));
}

export function chicagoDateKey(value = Date.now()) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function bundleOf(issue) {
  try { return extractStoryBundle(issue?.body || ""); }
  catch { return null; }
}

function terminal(labels) {
  return labels.has("published")
    || labels.has("editorial-approved")
    || labels.has("rejected")
    || labels.has("daily-overflow");
}

function explicitAction(labels) {
  if (labels.has("redraft-requested")) return "article";
  if (labels.has("regenerate-requested")) return "chat";
  return "";
}

function priority(item) {
  if (item.explicit && item.action === "article") return 0;
  if (item.explicit && item.action === "chat") return 1;
  if (item.labels.has("needs-editor")) return 3;
  return 2;
}

export function selectEditorialWork(issues, options = {}) {
  const today = options.today || chicagoDateKey();
  const targetIssue = Number(options.targetIssue || 0);
  const targetAction = options.targetAction === "chat" ? "chat" : "article";
  const limit = Math.max(1, Number(options.limit || 20));
  const forceBatch = options.forceBatch === true;
  const todayOnly = options.todayOnly !== false;
  const source = (issues || []).filter((issue) => !issue?.pull_request);
  const batchRequested = forceBatch || source.some((issue) => labelsOf(issue).has("draft-batch-requested"));

  const eligible = source.flatMap((issue) => {
    const labels = labelsOf(issue);
    if (terminal(labels)) return [];
    const bundle = bundleOf(issue);
    const requestedAction = explicitAction(labels);
    const targeted = targetIssue > 0 && Number(issue.number) === targetIssue;
    const explicit = targeted || Boolean(requestedAction);
    const current = bundle?.event?.eventDate === today;
    const batchEligible = batchRequested
      && (!todayOnly || current)
      && !labels.has("ready-for-approval");
    if (!explicit && !batchEligible) return [];
    return [{
      issue: Number(issue.number),
      action: targeted ? targetAction : (requestedAction || "article"),
      explicit,
      labels,
      hasBundle: Boolean(bundle)
    }];
  });

  eligible.sort((left, right) => priority(left) - priority(right) || right.issue - left.issue);
  return {
    batchRequested,
    selected: eligible.slice(0, limit).map(({ issue, action }) => ({ issue, action })),
    remaining: Math.max(0, eligible.length - limit),
    invalid: eligible.filter((item) => !item.hasBundle).map((item) => item.issue)
  };
}
