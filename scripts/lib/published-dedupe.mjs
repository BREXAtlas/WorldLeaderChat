const MERGE_RULES = [
  {
    canonicalId: "2026-08-08-ukraine-russia-pounds-kyiv-as-zelenskyy-visits-serbia",
    duplicateIds: [
      "2026-08-08-child-among-three-killed-in-russian-missile-attacks-near-kyiv"
    ],
    reviewNote: "Merged BBC and DW coverage of the same August 8 Kyiv-strikes and Zelenskyy-in-Serbia news cycle into one file."
  },
  {
    canonicalId: "2026-08-09-why-is-pezeshkian-urging-an-end-to-iran-s-no-war-no-peace-status",
    duplicateIds: [
      "2026-08-06-iran-aims-to-ban-u-s-and-israeli-ships-from-strait-of-hormuz-and"
    ],
    summary: "Iranian President Masoud Pezeshkian urged a lasting agreement with the United States while Iran also considered restrictions and tolls for ships linked to hostile countries in the Strait of Hormuz, according to Al Jazeera and NPR.",
    reviewNote: "Merged the overlapping Iran-U.S. deadlock and Strait of Hormuz access coverage into one sourced Hormuz file instead of repeating the same chat premise."
  },
  {
    canonicalId: "2026-08-09-israel-rejects-trump-s-15-point-plan-for-gaza",
    duplicateIds: [
      "2026-08-09-netanyahu-rejects-trump-backed-gaza-peace-plan",
      "2026-08-09-netanyahu-rejects-trump-s-gaza-peace-plan-demands-hamas-disarm-f",
      "2026-08-10-netanyahu-rejects-us-backed-15-point-gaza-peace-plan-first-thing"
    ],
    reviewNote: "Merged DW, NPR and later Guardian follow-up coverage of the same Gaza-plan rejection into the canonical multi-source file."
  }
];

function unique(values) {
  return [...new Set(values.filter((value) => value !== undefined && value !== null && value !== ""))];
}

function mergeSources(events) {
  const byUrl = new Map();
  for (const event of events) {
    for (const source of event?.sources || []) {
      if (source?.url && !byUrl.has(source.url)) byUrl.set(source.url, source);
    }
  }
  return [...byUrl.values()];
}

function mergeEditorial(canonical, duplicates, rule, sourceCount) {
  const records = [canonical, ...duplicates].map((event) => event?.editorial || {});
  const issueNumbers = unique(records.flatMap((record) => [record.issueNumber, ...(record.mergedIssueNumbers || [])]))
    .map(Number)
    .filter(Number.isInteger)
    .sort((a, b) => a - b);
  const eventIds = unique([
    canonical.id,
    ...duplicates.map((event) => event.id),
    ...records.flatMap((record) => record.mergedEventIds || [])
  ]).sort();
  const reviewNotes = unique([
    ...records.map((record) => record.reviewNotes),
    rule.reviewNote
  ]).join(" ");

  return {
    ...(canonical.editorial || {}),
    singleSourceException: sourceCount >= 2 ? "" : (canonical.editorial?.singleSourceException || ""),
    reviewNotes,
    mergedIssueNumbers: issueNumbers,
    mergedEventIds: eventIds
  };
}

export function mergePublishedDuplicates(inputEvents) {
  const events = structuredClone(inputEvents || []);
  const removals = new Set();
  const changes = [];

  for (const rule of MERGE_RULES) {
    const canonical = events.find((event) => event.id === rule.canonicalId);
    const duplicates = events.filter((event) => rule.duplicateIds.includes(event.id));
    if (!canonical || !duplicates.length) continue;

    canonical.sources = mergeSources([canonical, ...duplicates]);
    if (rule.summary) canonical.summary = rule.summary;
    canonical.editorial = mergeEditorial(canonical, duplicates, rule, canonical.sources.length);
    duplicates.forEach((event) => removals.add(event.id));
    changes.push({
      canonicalId: canonical.id,
      removedIds: duplicates.map((event) => event.id),
      sourceCount: canonical.sources.length
    });
  }

  return {
    events: events.filter((event) => !removals.has(event.id)),
    changes
  };
}

export const publishedMergeRules = MERGE_RULES;
