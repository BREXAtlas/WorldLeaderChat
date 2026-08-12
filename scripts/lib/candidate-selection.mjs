function publisherKey(value) {
  return String(value || "Unknown publisher").trim().toLocaleLowerCase("en-US");
}

function candidatePublishers(candidate) {
  const values = (candidate.sources || []).map((source) => source.publisher);
  if (candidate.publisher) values.push(candidate.publisher);
  return [...new Set(values.filter(Boolean).map((publisher) => String(publisher).trim()))];
}

function marketKey(value) {
  return String(value || "global").trim().toLocaleLowerCase("en-US");
}

function candidateMarkets(candidate) {
  if (candidate.coverageMarket) {
    const coverageMarket = marketKey(candidate.coverageMarket);
    return new Set(coverageMarket === "us" ? ["us"] : [coverageMarket, "international"]);
  }
  const values = (candidate.sources || []).map((source) => source.market);
  if (candidate.sourceMarket) values.push(candidate.sourceMarket);
  const markets = new Set(values.filter(Boolean).map(marketKey));
  if ([...markets].some((market) => market !== "us")) markets.add("international");
  return markets;
}

function orientationKey(value) {
  const orientation = String(value || "neutral").trim().toLocaleLowerCase("en-US");
  return orientation === "left" || orientation === "right" ? orientation : "neutral";
}

function candidatePublisherRecords(candidate) {
  const records = (candidate.sources || []).map((source) => ({
    publisher: String(source.publisher || "").trim(),
    orientation: orientationKey(source.orientation)
  }));
  if (candidate.publisher) records.push({
    publisher: String(candidate.publisher).trim(),
    orientation: orientationKey(candidate.orientation)
  });
  const unique = new Map();
  for (const record of records) {
    if (!record.publisher) continue;
    unique.set(`${publisherKey(record.publisher)}:${record.orientation}`, record);
  }
  return [...unique.values()];
}

function increment(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

function baseComparator(isCurrentDay) {
  return (left, right) => {
    const currentDayDifference = Number(isCurrentDay(right)) - Number(isCurrentDay(left));
    if (currentDayDifference) return currentDayDifference;
    if ((right.relevanceScore || 0) !== (left.relevanceScore || 0)) {
      return (right.relevanceScore || 0) - (left.relevanceScore || 0);
    }
    return String(right.publishedAt || "").localeCompare(String(left.publishedAt || ""));
  };
}

/**
 * Balance a review queue by desk and publisher while preserving score/date order.
 * Publisher limits are deliberately soft: a quiet desk still gets recommendations
 * when only one publisher has usable coverage, but a high-volume feed cannot take
 * every slot when alternatives exist.
 */
export function selectDiverseCandidates(clusters, options = {}) {
  const {
    limit = 24,
    requiredDesks = [],
    minimumPerDesk = 2,
    maximumPerDesk = 4,
    maximumPerCategory = 4,
    maximumPerPublisher = 4,
    minimumPublishers = 8,
    minimumPublishersPerDesk = 2,
    minimumPublishersPerOrientation = 4,
    maximumOrientationDifference = 1,
    minimumCandidatesPerDeskMarket = {},
    isCurrentDay = () => false
  } = options;

  const selected = [];
  const selectedIds = new Set();
  const categoryCounts = new Map();
  const deskCounts = new Map();
  const primaryPublisherCounts = new Map();
  const coveredPublishers = new Set();
  const deskPublishers = new Map(requiredDesks.map((desk) => [desk, new Set()]));
  const orientationPublishers = new Map([
    ["left", new Set()],
    ["right", new Set()],
    ["neutral", new Set()]
  ]);
  const compareBase = baseComparator(isCurrentDay);
  const sorted = [...clusters].sort(compareBase);

  const canAdd = (candidate) => {
    if (selectedIds.has(candidate.fingerprint)) return false;
    if ((categoryCounts.get(candidate.category) || 0) >= maximumPerCategory) return false;
    if ((deskCounts.get(candidate.newsroomDesk) || 0) >= maximumPerDesk) return false;
    return true;
  };

  const add = (candidate) => {
    selected.push(candidate);
    selectedIds.add(candidate.fingerprint);
    increment(categoryCounts, candidate.category);
    increment(deskCounts, candidate.newsroomDesk);
    increment(primaryPublisherCounts, publisherKey(candidate.publisher));
    const deskSet = deskPublishers.get(candidate.newsroomDesk) || new Set();
    for (const publisher of candidatePublishers(candidate)) {
      coveredPublishers.add(publisherKey(publisher));
      deskSet.add(publisherKey(publisher));
    }
    for (const record of candidatePublisherRecords(candidate)) {
      orientationPublishers.get(record.orientation).add(publisherKey(record.publisher));
    }
    deskPublishers.set(candidate.newsroomDesk, deskSet);
  };

  const addsOrientationPublisher = (candidate, orientation) => candidatePublisherRecords(candidate)
    .some((record) => record.orientation === orientation
      && !orientationPublishers.get(orientation).has(publisherKey(record.publisher)));

  const preferredPartisanOrientation = () => {
    const left = orientationPublishers.get("left").size;
    const right = orientationPublishers.get("right").size;
    if (left < minimumPublishersPerOrientation || right < minimumPublishersPerOrientation) {
      if (left < right) return "left";
      if (right < left) return "right";
    }
    if (Math.abs(left - right) > maximumOrientationDifference) return left < right ? "left" : "right";
    return null;
  };

  const choose = (pool, desk = null) => {
    if (!pool.length) return null;
    let choices = pool;
    const currentDay = choices.filter(isCurrentDay);
    if (currentDay.length) choices = currentDay;

    if (desk) {
      const usedByDesk = deskPublishers.get(desk) || new Set();
      if (usedByDesk.size < minimumPublishersPerDesk) {
        const newForDesk = choices.filter((candidate) => candidatePublishers(candidate)
          .some((publisher) => !usedByDesk.has(publisherKey(publisher))));
        if (newForDesk.length) choices = newForDesk;
      }
    }

    if (coveredPublishers.size < minimumPublishers) {
      const newForRun = choices.filter((candidate) => candidatePublishers(candidate)
        .some((publisher) => !coveredPublishers.has(publisherKey(publisher))));
      if (newForRun.length) choices = newForRun;
    }

    const preferredOrientation = preferredPartisanOrientation();
    if (preferredOrientation) {
      const balancingChoices = choices.filter((candidate) => addsOrientationPublisher(candidate, preferredOrientation));
      if (balancingChoices.length) choices = balancingChoices;
    }

    const belowPublisherLimit = choices.filter((candidate) =>
      (primaryPublisherCounts.get(publisherKey(candidate.publisher)) || 0) < maximumPerPublisher
    );
    if (belowPublisherLimit.length) choices = belowPublisherLimit;

    return [...choices].sort((left, right) => {
      const publisherDifference = (primaryPublisherCounts.get(publisherKey(left.publisher)) || 0)
        - (primaryPublisherCounts.get(publisherKey(right.publisher)) || 0);
      return publisherDifference || compareBase(left, right);
    })[0];
  };

  // Reserve configured market representation before the general desk pass.
  // This keeps a high-volume international feed from crowding U.S. league
  // coverage out of the Sports & Soft Power review slate (and vice versa).
  for (const [desk, requirements] of Object.entries(minimumCandidatesPerDeskMarket)) {
    for (const [market, minimum] of Object.entries(requirements || {})) {
      while (selected.length < limit
        && selected.filter((candidate) => candidate.newsroomDesk === desk
          && candidateMarkets(candidate).has(marketKey(market))).length < Number(minimum || 0)) {
        const candidate = choose(sorted.filter((item) => item.newsroomDesk === desk
          && candidateMarkets(item).has(marketKey(market))
          && canAdd(item)), desk);
        if (!candidate) break;
        add(candidate);
      }
    }
  }

  // Give every public desk its required recommendations first. When a desk has
  // multiple publishers available, its first two recommendations use different ones.
  for (const desk of requiredDesks) {
    while ((deskCounts.get(desk) || 0) < minimumPerDesk && selected.length < limit) {
      const candidate = choose(sorted.filter((item) => item.newsroomDesk === desk && canAdd(item)), desk);
      if (!candidate) break;
      add(candidate);
    }
  }


  // Fill partisan-source deficits before general extras. This is a source-pool
  // guard, not an instruction to alter facts or force a viewpoint into a story.
  while (selected.length < limit) {
    const left = orientationPublishers.get("left").size;
    const right = orientationPublishers.get("right").size;
    const deficient = left < minimumPublishersPerOrientation
      ? "left"
      : right < minimumPublishersPerOrientation
        ? "right"
        : Math.abs(left - right) > maximumOrientationDifference
          ? (left < right ? "left" : "right")
          : null;
    if (!deficient) break;
    const candidate = choose(sorted.filter((item) => canAdd(item) && addsOrientationPublisher(item, deficient)));
    if (!candidate) break;
    add(candidate);
  }

  // Before adding general extras, represent additional publishers until the run
  // reaches its configured minimum (when the available feed pool permits it).
  while (selected.length < limit && coveredPublishers.size < minimumPublishers) {
    const newPublisherCandidates = sorted.filter((candidate) => canAdd(candidate)
      && candidatePublishers(candidate).some((publisher) => !coveredPublishers.has(publisherKey(publisher))));
    const candidate = choose(newPublisherCandidates);
    if (!candidate) break;
    add(candidate);
  }

  // Fill remaining slots with the least-used publisher first, then score/date.
  while (selected.length < limit) {
    const candidate = choose(sorted.filter(canAdd));
    if (!candidate) break;
    add(candidate);
  }

  return selected;
}

export function summarizePublisherCoverage(candidates, requiredDesks = []) {
  const publisherArticles = new Map();
  const primaryPublisherArticles = new Map();
  const desks = new Map(requiredDesks.map((desk) => [desk, new Map()]));
  const orientations = new Map([
    ["left", new Map()],
    ["right", new Map()],
    ["neutral", new Map()]
  ]);

  for (const candidate of candidates) {
    increment(primaryPublisherArticles, candidate.publisher || "Unknown publisher");
    const desk = desks.get(candidate.newsroomDesk) || new Map();
    for (const publisher of candidatePublishers(candidate)) {
      increment(publisherArticles, publisher);
      increment(desk, publisher);
    }
    for (const record of candidatePublisherRecords(candidate)) {
      increment(orientations.get(record.orientation), record.publisher);
    }
    desks.set(candidate.newsroomDesk, desk);
  }

  const sortedObject = (map) => Object.fromEntries([...map.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])));

  return {
    distinctPublishers: publisherArticles.size,
    publishers: sortedObject(publisherArticles),
    primaryPublishers: sortedObject(primaryPublisherArticles),
    orientations: Object.fromEntries([...orientations.entries()].map(([orientation, publishers]) => [orientation, {
      distinctPublishers: publishers.size,
      publishers: sortedObject(publishers)
    }])),
    desks: Object.fromEntries([...desks.entries()].map(([desk, publishers]) => [desk, {
      distinctPublishers: publishers.size,
      publishers: sortedObject(publishers)
    }]))
  };
}
