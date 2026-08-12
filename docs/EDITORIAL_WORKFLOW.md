# Editorial workflow

This document is the publication rulebook for World Leader Chat. The goal is not merely to make the chat funny. The goal is to keep the boundary between **verified public events** and **invented private satire** unmistakable.

## Roles

### Ingestion bot

The scheduled workflow may collect public feed metadata, score relevance and open an issue. It cannot approve facts, write to `data/published-events.json` or deploy a new story.

### Editor

A repository writer, maintainer or administrator reviews sources, writes or revises the fictional conversation, completes the fact-check fields and applies the approval labels.

### Publisher workflow

The publisher is mechanical. It verifies the editor's permission, labels, JSON structure, source rules, quote attribution and placeholder removal. It does not make judgment calls on behalf of the editor.

## Candidate lifecycle

### 1. Intake

`News ingestion` creates an issue with:

- the source headline and link;
- publication time when available;
- relevance score and matched terms;
- a source fingerprint used for deduplication; and
- a machine-readable editorial JSON block.

New issues receive:

- `news-candidate`
- `needs-editor`

A rejected candidate receives `rejected`, is closed, and moves immediately into the editor's Trash lane. It no longer contributes to the review count. Restoring it reopens the file in Ready for Approval when it still passes validation, or in Drafting when it needs correction. Permanently deleting it removes the article contents but retains a hidden fingerprint tombstone; that tombstone prevents the same feed item from being opened repeatedly.

### 2. Source review

Open every listed source. Do not approve from the feed excerpt alone.

The ordinary rule is **two reliable sources**. The second source should independently support the event's core factual claim. A primary source—official transcript, government statement, court record, election authority, treaty text or full video—is especially valuable.

A one-source story can proceed only when the source is unusually authoritative or the event is too new for independent reporting. Set:

```json
"twoSourceRuleMet": false,
"singleSourceException": "A specific explanation of at least 20 characters"
```

Do not use the exception merely to save time.

### 3. Edit the story JSON

Edit only the JSON between:

```text
<!-- WLC_STORY_JSON_START -->
<!-- WLC_STORY_JSON_END -->
```

Replace every `[EDITOR: ...]`, `TODO`, `TBD`, `WRITE THIS` or `REPLACE ME` marker. The workflow rejects unresolved placeholders.

The `event` object requires:

- a stable lowercase `id`;
- ISO `eventDate` and matching numeric `year`;
- readable display `date`;
- Drudge-style `title`;
- concise `kicker`;
- category;
- verified factual `summary`;
- source list;
- 5–30 chat messages, including at least three fictional satire messages;
- meme line;
- optional public quote; and
- `comic` or `sober` tone.

### 4. Separate fact from fiction

The summary is factual prose. It must not contain an invented private motive, invented conversation or claim that a leader secretly did something.

Chat message kinds are:

- `system` — invented group notices, visibly gray on the site;
- `satire` — invented parody, visibly green and labeled **FICTIONAL SATIRE**;
- `public` — a brief genuine public excerpt, visibly yellow and labeled **PUBLIC RECORD**.

Every `public` message must include `sourceUrl`, and that exact URL must also appear in `event.sources`.

Chats must read like an organic reaction to the event, not a newsroom summary of the file. Do not paste the headline into a message, write “I read [headline],” or recycle a fixed exchange by substituting new speakers, publishers or titles. Automated checks reject known filler phrases, headline echoes and structurally similar conversations before a file can return to Ready for Approval.

Example:

```json
{
  "speaker": "Leader Name",
  "text": "Public record: a brief exact excerpt.",
  "kind": "public",
  "reaction": "",
  "sourceUrl": "https://example.gov/transcript"
}
```

Public excerpts are capped at 280 characters. Use paraphrase in the factual summary when more context is necessary.

An optional top-level quote follows the same rule:

```json
"quote": {
  "speaker": "Leader Name",
  "text": "Brief exact public quotation.",
  "sourceUrl": "https://example.gov/transcript"
}
```

### 5. Write responsible satire

Use public conduct, speaking rhythms, policy positions, diplomatic tension, bureaucracy and ego as material. Do not invent:

- crimes or corruption;
- medical or psychiatric diagnoses;
- sexual conduct;
- addiction;
- private family allegations;
- hidden religious or ethnic motives; or
- a threat that the person did not publicly make.

For war, terrorism, death, disaster, mass casualty, famine, active hostage cases or civil unrest, set `tone` to `sober` unless the jokes are clearly remote from human suffering. Aim satire at leaders, institutions, propaganda, failed planning and performative diplomacy—not victims.

Consult `config/leader-voice-notes.json` for broad parody cues. Those notes are writing aids, not factual claims about private personality.

### 6. Complete the fact-check object

All of these must be `true`:

```json
{
  "sourceOpened": true,
  "summaryVerified": true,
  "namesAndTitlesVerified": true,
  "publicQuotesVerified": true,
  "satireTargetsPowerNotVictims": true,
  "sensitiveEventReview": true,
  "clearSatireLabel": true
}
```

Then set either `twoSourceRuleMet` to `true` with at least two listed sources, or provide the written exception described above.

Change:

```json
"status": "draft"
```

to:

```json
"status": "approved"
```

`approval.approvedBy` and `approval.approvedAt` are written automatically from the GitHub event. The editor may add `approval.reviewNotes`.

### 7. Approve in the correct order

Apply:

1. `fact-checked`
2. `editorial-approved`

Adding `editorial-approved` starts publication immediately. The workflow verifies that the labeler has `write`, `maintain` or `admin` permission.

On success, the workflow:

1. appends the event to `data/published-events.json`;
2. records an audit entry in `data/editorial-log.json`;
3. commits to `main` as `world-leader-chat-bot`;
4. builds the public artifact;
5. deploys GitHub Pages;
6. adds `published`;
7. removes `needs-editor` and `editorial-approved`; and
8. closes the issue with the commit and site URL.

If validation or deployment fails, the issue remains open and receives retry instructions. Correct the JSON, then remove and re-add `editorial-approved`.

## Corrections and removals

Use the **Source correction or satire concern** issue form.

For a factual correction:

1. verify the replacement source;
2. edit `data/published-events.json` in a pull request;
3. add a note to `data/editorial-log.json` describing the correction;
4. run `npm test && npm run validate && npm run build`; and
5. merge after review.

For urgent removal of dangerous or materially false content, remove the event first and document the reason immediately afterward. Git history preserves the audit trail; do not rewrite history merely to hide an editorial error.

## Recommended branch protection

Protect `main` and require:

- the `Validate repository` status check;
- CODEOWNER review for code and data changes;
- dismissal of stale approvals after new commits; and
- no force pushes.

Issue-label publication remains intentionally separate: the authorized editor's label is the human approval event, and the workflow records it in the published event metadata.
