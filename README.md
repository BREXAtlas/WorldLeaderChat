# World Leader Chat

[![Validate repository](https://github.com/BREXAtlas/WorldLeaderChat/actions/workflows/ci.yml/badge.svg)](https://github.com/BREXAtlas/WorldLeaderChat/actions/workflows/ci.yml)

**World Leader Chat** is a sourced political-satire archive presented as the fictional group chat world leaders would never admit exists.

The front page uses a dense, old-school headline layout. Every story opens into a Signal-style fictional conversation. Verified event summaries and source links are separated from invented satire, and short genuine public excerpts are visibly labeled.

## What is in this repository

- `index.html` — the complete 2020–2026 archive and interactive chat reader.
- `data/published-events.json` — editor-approved updates added after the original archive.
- `config/news-sources.json` — RSS/Atom sources and relevance-scoring terms.
- `config/leader-voice-notes.json` — broad parody cues and safety boundaries for recurring figures.
- `scripts/` — feed parsing, scoring, issue creation, validation, publishing and static-site build logic.
- `.github/workflows/` — continuous validation, scheduled ingestion, editorial publishing and GitHub Pages deployment.

## The core rule

**Automation may discover a story, but automation cannot publish a story.**

Every six hours, the ingestion workflow scans configured feeds, ranks likely world-leader stories and creates deduplicated GitHub issues labeled `news-candidate` and `needs-editor`. It does not write satire into the live site and does not modify published data.

A story reaches the site only after a write-authorized repository editor:

1. opens and verifies the source;
2. adds a second source or explains a one-source exception;
3. replaces every editorial placeholder;
4. checks names, titles, summaries and public quotations;
5. confirms that the satire targets power rather than victims;
6. applies `fact-checked`; and
7. applies `editorial-approved`.

The approval workflow then validates the issue JSON, checks the approving actor's repository permission, commits the event, rebuilds the site, deploys GitHub Pages, labels the issue `published` and closes it.

See [Editorial Workflow](docs/EDITORIAL_WORKFLOW.md) for the exact procedure.

## GitHub Actions

| Workflow | Trigger | Purpose |
|---|---|---|
| `Validate repository` | Push, pull request, manual | Runs unit tests, policy validation and a static build. |
| `News ingestion` | Every six hours, manual | Reads feeds, scores stories and opens editorial issues. Never publishes. |
| `Editorial approval and publish` | `editorial-approved` issue label | Verifies labels and actor permission, validates the story, commits it and deploys it. |
| `Deploy GitHub Pages` | Normal push to `main`, manual | Builds and deploys the current approved archive. |

The workflows use the repository-scoped `GITHUB_TOKEN`; no external API key is required.

## First-time repository setup

1. Open **Settings → Pages** and choose **GitHub Actions** as the publishing source.
2. Open **Actions → Deploy GitHub Pages → Run workflow** for the first deployment.
3. Protect workflow and code changes through reviewed pull requests. Because the approved-story workflow intentionally commits its validated data directly to `main`, do not enable a blanket “pull request required” rule on `main` unless that rule explicitly accommodates the publisher or the publisher is redesigned to open pull requests. A safe baseline is to block force pushes and branch deletion and require owner review for changes under `.github/workflows/`.
4. Open **Actions → News ingestion → Run workflow** to create the first editorial queue immediately instead of waiting for the scheduled run.

The expected project-site URL is:

`https://brexatlas.github.io/WorldLeaderChat/`

GitHub may preserve the repository-name capitalization in links while serving paths case-insensitively.

## Local development

Node.js 24 is the workflow runtime.

```bash
npm test
npm run validate
npm run build
python -m http.server 8000
```

Then open `http://localhost:8000/`. Serving over HTTP is necessary because the live-update JSON cannot be fetched reliably from a `file://` URL.

The build output is written to `_site/`. Only the public HTML, published event data and public site metadata are deployed. Editorial logs, source configuration and automation scripts are not included in the Pages artifact.

## Adding or removing feeds

Edit `config/news-sources.json`. A source must use HTTPS and provide RSS, Atom or RDF-style items. The parser accepts common RSS and Atom fields, including `pubDate`, `published`, `updated`, `dc:date`, `description`, `summary` and `content:encoded`.

After changing feeds:

```bash
npm test
npm run validate
```

See [News Ingestion](docs/NEWS_INGESTION.md) for scoring and deduplication details.

## Editorial and legal posture

- All private chats are fictional and labeled as satire.
- Public-record excerpts are brief, source-linked and visually distinguished.
- The factual summary must not contain invented dialogue or unsupported claims.
- Tragedy, deaths, disasters and active hostage situations require sober treatment.
- The project does not use synthetic audio, fabricated screenshots of real accounts or claims that the fictional messages were leaked.
- Corrections can be filed with the repository's **Source correction or satire concern** issue form.

## Repository status

This repository is intentionally dependency-light. Runtime scripts use Node.js built-ins, reducing package-supply-chain exposure and eliminating an install step in GitHub Actions.
