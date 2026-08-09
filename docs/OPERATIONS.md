# Operations guide

## First deployment

1. Commit the repository contents to `main`.
2. In **Settings → Pages**, select **GitHub Actions**.
3. In **Actions**, open **Deploy GitHub Pages** and choose **Run workflow**.
4. Confirm the `github-pages` environment was created and the deployment URL appears in the run summary.
5. Open the site and verify that the satire disclosure, year navigation and event dialog load.

The Pages build intentionally exposes only `_site/`:

- `index.html` and `404.html`;
- `data/published-events.json`;
- `data/site-meta.json`;
- `.nojekyll`; and
- `robots.txt`.

The private editorial audit is still in the public repository because the repository itself is public, but it is not copied into the website artifact. Do not put secrets, embargoed information or private notes in issues, JSON or logs.

## First ingestion run

1. Open **Actions → News ingestion**.
2. Choose **Run workflow**.
3. Keep the defaults for the first run.
4. Open the Issues tab and filter by `news-candidate`.
5. Review and either reject or edit candidates according to `EDITORIAL_WORKFLOW.md`.

No repository secret is required. GitHub automatically supplies a short-lived `GITHUB_TOKEN` scoped by each workflow's explicit `permissions` block.

## Routine checks

Weekly:

- review failed scheduled runs;
- close or reject stale candidates;
- check broken source links reported through correction issues;
- confirm the latest published event appears on the site; and
- review feed errors for sources that may have changed format or URL.

Monthly:

- review `config/news-sources.json` for source diversity;
- inspect relevance terms for blind spots or noisy matches;
- check GitHub Actions major-version updates;
- confirm branch protection and Pages environment rules; and
- sample published public quotations against their linked sources.

## Branch and ruleset compatibility

The approved-story workflow performs a narrow direct commit to `main` after it validates the issue, verifies the approving actor, runs the test suite and passes repository policy checks. A branch rule that requires every update to arrive through a pull request will block that publish step.

For the current architecture:

- block force pushes and branch deletion;
- require reviewed pull requests for human-authored code and workflow changes;
- keep `.github/workflows/` under CODEOWNER review; and
- do not require a pull request for the publisher's generated data commit unless the workflow is redesigned to open and merge a publishing pull request.

The publisher stages only `data/published-events.json`, `data/editorial-log.json` and `data/site-meta.json`.

## Manual deployment

A normal human push to `main` affecting public files triggers `Deploy GitHub Pages`.

A commit made by `GITHUB_TOKEN` does not reliably trigger another push workflow. For that reason, `Editorial approval and publish` builds and deploys the approved commit in the same workflow run.

## Failed editorial publication

The workflow leaves the issue open and comments with retry instructions.

Common failures:

- missing `fact-checked` label;
- approval applied by an actor without write permission;
- unresolved `[EDITOR: ...]` placeholder;
- fewer than five chat messages;
- fewer than three satire messages;
- public quote lacks `sourceUrl`;
- public quote URL is not listed in `event.sources`;
- fewer than two sources without a written exception;
- event ID or source URL already published; or
- GitHub Pages is not configured to use Actions.

Correct the issue body, remove `editorial-approved`, then add it again.

## Rollback

For a bad deployment without bad data, rerun the last successful Pages workflow or redeploy a known-good commit.

For bad editorial data:

1. revert the publishing commit or remove/correct the event in a reviewed pull request;
2. run validation and build checks;
3. deploy the corrected `main`; and
4. document the correction in the original issue and `data/editorial-log.json`.

## Permissions

- Ingestion: `contents: read`, `issues: write`.
- Validation: `contents: read`.
- Ordinary Pages deployment: `contents: read`, `pages: write`, `id-token: write`.
- Editorial publication: `contents: write`, `issues: write`, `pages: write`, `id-token: write`.

The editorial workflow checks the GitHub permission of the actor who added the approval label. A reader or outside issue participant cannot publish by adding text to an issue.
