function publisherKey(value) {
  return String(value || "Unknown publisher").trim().toLocaleLowerCase("en-US");
}

function candidatePublishers(candidate) {
  const values = (candidate.sources || []).map((source) => source.publisher);
  if (candidate.publisher) values.push(candidate.publisher);
  return [...new Set(values.filter(Boolean).map((publisher) => String(publisher).trim()))];
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
    isCurrentDay = () => false
  } = options;

  const selected = [];
  const selectedIds = new Set();
  const categoryCounts = new Map();
  const deskCounts = new Map();
  const primaryPublisherCounts = new Map();
  const coveredPublishers = new Set();
  const deskPublishers = new Map(requiredDesks.map((desk) => [desk, new Set()]));
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
    deskPublishers.set(candidate.newsroomDesk, deskSet);
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

  // Give every public desk its required recommendations first. When a desk has
  // multiple publishers available, its first two recommendations use different ones.
  for (const desk of requiredDesks) {
    for (let slot = 0; slot < minimumPerDesk && selected.length < limit; slot += 1) {
      const candidate = choose(sorted.filter((item) => item.newsroomDesk === desk && canAdd(item)), desk);
      if (!candidate) break;
      add(candidate);
    }
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

  for (const candidate of candidates) {
    increment(primaryPublisherArticles, candidate.publisher || "Unknown publisher");
    const desk = desks.get(candidate.newsroomDesk) || new Map();
    for (const publisher of candidatePublishers(candidate)) {
      increment(publisherArticles, publisher);
      increment(desk, publisher);
    }
    desks.set(candidate.newsroomDesk, desk);
  }

  const sortedObject = (map) => Object.fromEntries([...map.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])));

  return {
    distinctPublishers: publisherArticles.size,
    publishers: sortedObject(publisherArticles),
    primaryPublishers: sortedObject(primaryPublisherArticles),
    desks: Object.fromEntries([...desks.entries()].map(([desk, publishers]) => [desk, {
      distinctPublishers: publishers.size,
      publishers: sortedObject(publishers)
    }]))
  };
}
