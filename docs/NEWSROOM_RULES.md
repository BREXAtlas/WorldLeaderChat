# World Leaders Chat newsroom contract

These are the publication rules for the public newsroom and editor. They are structural product requirements, not optional drafting suggestions.

## Short reports

- Every publishable file contains a factual short report of 3–5 paragraphs and 100–500 words.
- The opening explains what happened. The middle extracts the important facts and consequences. The ending explains why the imagined chat is worth reading.
- World Leaders Chat may use dry humor, comparison and sharp framing. It may not invent an event, result, statistic, quotation, motive, meeting, private communication or source.
- The report may use only the verified source material attached to that editorial file. Source credit must name exactly those linked publishers and must remain outside the report body.
- The editor displays the entire short report and blocks approval when the report or conversation fails validation. A failed item returns to the ready lane and still requires the owner to approve it again.

## Daily newsroom and archive

- The current newsroom contains the current Chicago calendar day plus the previous seven days: eight days inclusive.
- At midnight Chicago time, the oldest complete day leaves the current newsroom and moves into the archive automatically. For example, on August 11, 2026, August 3 files are archived and August 4–11 remain current.
- Archived files are grouped by publication day inside their month. Existing archive filters and article URLs remain available.
- Ingestion runs four times daily for the 8 a.m., noon, 4 p.m. and 8 p.m. review windows. Drafting aims for at least two ready choices per active desk and uses publisher diversity controls.

## Protected public behavior

The following behavior is required: the owner-selected main headline, newsroom category colors, crisis/event/leader search, sponsor sidebar, footer identity, source links, article/chat modal, format selector, Copy Article + Chat, Copy Social Version, Save Social PNG, Share Social PNG, Save Social Carousel and Share Social Carousel.

Automated article publication may update approved event data. It may not change page structure, editor behavior, archive rules, branding, sponsor placement, exports or required actions. Pull requests that change protected newsroom structure must carry the `owner-approved-structure` label and receive the repository owner’s review. CI enforces the label; CODEOWNERS identifies the responsible owner.

## Owner-submitted sources

- The private editor may accept 1–5 public HTTPS links, a newsroom desk, a topic and verified source notes for a custom article.
- Submission creates an editorial file in Drafting. Safe public metadata is enriched in the existing GitHub workflow; private, local-network and credential-bearing URLs are rejected.
- The generator must create the same complete source-locked report and article-specific chat required of scheduled recommendations. It may not publish automatically. The owner reviews the full result and uses the normal Approve & Publish action.
