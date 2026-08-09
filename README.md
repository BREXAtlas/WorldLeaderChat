# World Leader Chat

**World Leader Chat** is an interactive political-satire archive presented as a fictional world-leader group chat. It pairs sourced summaries of real public events with clearly labeled invented dialogue.

> **Satire disclosure:** Private chats on this site are fictional. The project does not claim access to private messages, classified material, or leaders' unspoken thoughts. Exact public comments must be labeled **PUBLIC RECORD** and linked to their source.

The repository includes the original 2020–2026 archive, a GitHub Pages deployment, scheduled world-news discovery, and a human editorial approval gate. Automated ingestion can suggest stories; it cannot publish them.

## What ships

- A responsive, Drudge-inspired archive with search, year filters, Fact Mode, Meme Mode, deep links, chat replay, sources, and local browser drafts.
- Forty-five sourced event chapters spanning 2020–2026.
- A keyless GDELT DOC 2.0 ingestion job that runs every six hours and writes only to `content/inbox/`.
- A draft editorial-queue pull request for newly discovered candidates.
- A manual promotion workflow requiring an edited `ready` candidate and the exact confirmation `APPROVE FOR PUBLICATION`.
- A separate publication pull request, content validation, automated tests, generated-data checks, and GitHub Pages deployment.
- CODEOWNERS, a correction issue form, and an editorial policy designed to keep fact, quotation, inference, and fiction visibly separate.

## Editorial pipeline

```text
GDELT discovery
      │
      ▼
content/inbox/candidate-*.json
(unpublished source lead)
      │
      ▼
Human verifies sources, writes the event and satire,
labels public quotations, and marks the candidate READY
      │
      ▼
Merge editorial-queue PR
      │
      ▼
Run “Promote approved candidate” manually
with APPROVE FOR PUBLICATION
      │
      ▼
Publication PR + CI + human review
      │
      ▼
Merge to main → GitHub Pages deploy
```

No scheduled job writes to `content/published/`, `public/data/events.json`, or the live site.

## Repository layout

```text
public/                         Static site deployed to GitHub Pages
public/data/events.json        Generated public event archive; do not hand-edit
content/published/             Editorially approved source of truth
content/inbox/                 Unpublished ingestion candidates
config/news-ingestion.json     Queries, scoring, domains, and leader aliases
scripts/                       Build, validation, ingestion, promotion, local server
.github/workflows/             Validation, ingestion, promotion, and deployment
.github/CODEOWNERS              Editorial ownership boundary
docs/EDITORIAL_POLICY.md       Publication and satire rules
docs/OPERATIONS.md             Setup and day-to-day workflow
```

## Local use

Node.js 20 or newer is required. GitHub Actions uses Node.js 24.

```bash
npm ci
npm run check
npm run serve
```

Then open `http://127.0.0.1:4173`.

Useful commands:

```bash
npm run build       # rebuild public/data from approved content
npm run validate    # validate published content and inbox candidates
npm test            # run unit and workflow-path tests
npm run ingest      # query configured provider and add unpublished candidates
```

The ingestion test suite uses a local fixture. Normal `npm run ingest` calls the configured GDELT endpoint.

## One-time GitHub settings

After the initial pull request is merged, configure these repository settings:

1. **Settings → Pages → Build and deployment → Source:** choose **GitHub Actions**.
2. **Settings → Actions → General → Workflow permissions:** use read/write permissions and enable **Allow GitHub Actions to create and approve pull requests**. The workflows only create draft queue PRs and publication PRs; they do not approve or merge them.
3. **Settings → Environments:** create `editorial-production`, add at least one required reviewer, and prevent self-review where the repository plan supports it. The manual promotion job targets this environment, so publication pauses at the human gate before files are changed.
4. Protect `main` and require the **Content, tests, and generated data** check. Require a CODEOWNER review for changes under `content/published/`, `content/inbox/`, `public/`, `scripts/`, and `.github/workflows/`.
5. Keep force pushes and direct pushes to `main` disabled once branch protection is active.

Without setting 2, ingestion still pushes the `automation/news-desk` branch, but GitHub may block the workflow from opening its pull request. Without setting 1, validation works but Pages deployment cannot finish. Without environment reviewers, promotion still requires the manual workflow confirmation but does not pause for a second GitHub reviewer.

## Adding an event manually

The preferred path is an ingested candidate. For an event not discovered automatically, copy the candidate structure documented in [`docs/OPERATIONS.md`](docs/OPERATIONS.md), add it to `content/inbox/`, and submit it through the same review and promotion process. Do not add future stories directly to `public/data/events.json`.

## Corrections

Use the **Editorial correction** issue form for a factual error, mislabeled quotation, broken source, identity confusion, or satire that could reasonably be mistaken for fact. Corrections to live content must go through a pull request and the same validation checks.

## Content and licensing

The application code and original editorial writing are not offered under an open-source license unless a separate license is added later. Linked reporting and public statements remain the property of their respective publishers or speakers. Keep quotations brief, attributed, and source-linked.
