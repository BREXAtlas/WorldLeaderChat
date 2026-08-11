# News ingestion service

The news-ingestion service is a GitHub Actions workflow and a set of dependency-free Node.js scripts. It discovers possible stories and opens an editorial queue. It never publishes directly.

## Schedule

`.github/workflows/news-ingestion.yml` starts forty minutes before the 8 AM, noon, 4 PM and 8 PM America/Chicago review windows and can also be launched manually.

Default manual inputs:

- lookback: 72 hours;
- minimum relevance score: 7;
- maximum new issues: 8.

GitHub may delay scheduled jobs during periods of heavy Actions load. Public-repository schedules can also be disabled by GitHub after prolonged repository inactivity; a manual run reactivates the workflow.

## Configured feeds

The initial configuration includes world or top-news feeds from:

- BBC News;
- The Guardian;
- Al Jazeera;
- DW;
- UN News; and
- NPR World.

Feeds are configured in `config/news-sources.json`. Every public topic desk has a multi-publisher source pool, including broad entertainment, arts, film, television and music coverage for Culture & Entertainment. The selector prefers at least two publishers per desk and eight across a run, and the run summary shows the actual mix. Feed inclusion means only that a headline may enter the review queue. It is not an editorial endorsement, and the editor must independently assess source quality and framing.

## Parsing

The parser supports common RSS, Atom and RDF-style structures. It reads:

- `item` or `entry` blocks;
- RSS text links or Atom `href` links;
- `pubDate`, `published`, `updated`, `dc:date` or `date`;
- `description`, `summary`, `content:encoded` or `content`; and
- `guid` or `id`.

HTML is removed from feed summaries, common entities are decoded, tracking query parameters are stripped and whitespace is normalized.

Each feed request has a timeout. One failed feed produces a workflow warning while other feeds continue. The run fails visibly only when every enabled source fails.

## Relevance scoring

The score combines:

- source weight;
- named leader matches;
- high-value geopolitical terms;
- supporting government and diplomatic terms;
- extra title matches; and
- negative weights for lifestyle or entertainment terms.

Stories mentioning both a leader and a major geopolitical term receive an additional boost. The configuration is transparent and editable; there is no hidden model deciding what becomes newsworthy.

The system suggests a broad category such as Election, War & Security, Diplomacy, Trade, Alliance or Breaking. The editor may replace it.

## Deduplication

There are two layers:

1. Within one run, normalized duplicate titles are collapsed and the higher-scoring version is retained.
2. Across runs, each source item receives a SHA-256 fingerprint based on normalized headline and canonical source URL. Existing open or closed `news-candidate` issues are scanned for that fingerprint.

Rejected and published issues remain useful deduplication records, so closing an issue does not cause the same feed item to return.

## Editorial issue generation

For each new candidate, `scripts/open-editorial-issues.mjs`:

1. ensures the workflow labels exist;
2. creates an issue titled `NEWS CANDIDATE: ...`;
3. includes the source, date, score and matched terms;
4. inserts a draft JSON story template; and
5. applies `news-candidate` and `needs-editor`.

The draft contains deliberate placeholders and failed fact-check booleans. This makes accidental publication impossible: the approval validator rejects the untouched template.

## Adding a feed

Add an object to `config/news-sources.json`:

```json
{
  "id": "example-world",
  "publisher": "Example News",
  "url": "https://example.com/world.rss",
  "enabled": true,
  "weight": 1
}
```

Use a stable HTTPS feed. Keep source weights modest; weights are tie-breakers, not a mechanism to force every item from one outlet into the queue.

Then run:

```bash
npm test
npm run validate
```

A feed that requires cookies, JavaScript rendering, authentication or scraping is not a good fit for this service. Add a provider API only after documenting licensing, retention, cost, rate limits and secret management.

## No automatic AI drafting

The initial service deliberately does not call a language model. A current headline can be surfaced automatically, but historical context, quotation verification, tone and satire remain editorial work.

An AI drafting stage can be added later behind a separate `draft-generated` label, but generated text should still begin in draft status and pass the identical human approval gate. It must never apply `fact-checked` or `editorial-approved` itself.
