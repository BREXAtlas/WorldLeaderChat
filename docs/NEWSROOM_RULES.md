# World Leaders Chat newsroom contract

These are the publication rules for the public newsroom and editor. They are structural product requirements, not optional drafting suggestions.

## Short reports

- Every publishable file contains a factual short report of 3–5 paragraphs and 100–500 words.
- The opening explains what happened. The middle extracts the important facts and consequences. The ending explains why the imagined chat is worth reading.
- World Leaders Chat may use dry humor, comparison and sharp framing. It may not invent an event, result, statistic, quotation, motive, meeting, private communication or source.
- The report may use only the verified source material attached to that editorial file. Source credit must name exactly those linked publishers and must remain outside the report body.
- The editor displays the entire short report and blocks approval when the report or conversation fails validation. When the owner selects Approve & Publish, the item immediately leaves Ready for Approval and enters Publishing. A successful run moves it to Published; a failed run returns it to Drafting for correction and another explicit approval.
- After the owner confirms Reject, the candidate immediately leaves its current editor queue while the rejection is saved. If the request fails, reloading restores the candidate so it cannot be silently lost.

## Daily newsroom and archive

- The current newsroom contains the current Chicago calendar day plus the previous seven days: eight days inclusive.
- At midnight Chicago time, the oldest complete day leaves the current newsroom and moves into the archive automatically. For example, on August 11, 2026, August 3 files are archived and August 4–11 remain current.
- Archived files are grouped by publication day inside their month. Existing archive filters and article URLs remain available.
- Ingestion runs four times daily for the 8 a.m., noon, 4 p.m. and 8 p.m. review windows. Drafting aims for at least two ready choices per active desk and uses publisher diversity controls.
- The featured carousel contains at most one current file per newsroom desk. An owner selection replaces only the selected desk slot; unselected desks use their newest current file.
- The news ticker contains at most 12 current event groups. It preserves one newest item per available desk first, then fills remaining positions by publication recency. A newer item displaces the oldest non-protected item when the ticker is full.
- Cards keep the complete kicker. Summaries of 62 words or fewer remain fully visible; longer summaries show a 30-word teaser and an article drawer with the remainder and the unchanged full-file action.

## Same-event coverage groups

- The front page shows only the newest approved file in a same-event coverage group. Every grouped file remains searchable, addressable by its article URL and available in the newest file’s **Check out these related articles** section.
- Grouping is event-level, not broad-topic-level. Two reports about the same Anthropic watermark announcement may group; an unrelated ChatGPT product story may not group merely because both concern AI.
- Explicit `eventGroup` or `relatedGroup` metadata is authoritative. Without it, reports group only when they share an original URL or pass the conservative headline/dek similarity rule within 21 calendar days.

## Source audit

- Each distinct source publisher receives a signed orientation score from −100 (strong left) through 0 (neutral) to +100 (strong right). Displayed percentages are absolute distance from neutral, not probabilities, trust scores, accuracy scores or endorsements.
- Bands are 0–14 Neutral, 15–39 Left/Right-leaning, 40–69 Left/Right and 70–100 Strong Left/Right.
- An article’s source-mix score is the arithmetic mean of one score per distinct publisher. Neutral can mean centered/primary/topic-limited sourcing or a left/right mix that balances near zero.
- Primary sources remain visibly identified as first-party material. Unknown outlets remain Neutral with low confidence pending review; they are not silently treated as independently verified news.
- Outlet orientation is not party affiliation. “Left” does not mean “Democratic Party,” and “Right” does not mean “Republican Party.” Ratings describe general sourcing orientation, not the truth of an individual report.

## Protected public behavior

The following behavior is required: the desk-based featured carousel, 12-item ticker, source audit, same-event related coverage, newsroom category colors, crisis/event/leader/source-orientation search, sponsor sidebar, footer identity, source links, article/chat modal, format selector, Copy Article + Chat, Copy Social Version, Save Social PNG, Share Social PNG, Save Social Carousel and Share Social Carousel.

Automated article publication may update approved event data. It may not change page structure, editor behavior, archive rules, branding, sponsor placement, exports or required actions. Pull requests that change protected newsroom structure must carry the `owner-approved-structure` label and receive the repository owner’s review. CI enforces the label; CODEOWNERS identifies the responsible owner.

## Owner-submitted sources

- The private editor may accept 1–5 public HTTPS links, a newsroom desk, a topic and verified source notes for a custom article.
- Submission creates an editorial file in Drafting. Safe public metadata is enriched in the existing GitHub workflow; private, local-network and credential-bearing URLs are rejected.
- The generator must create the same complete source-locked report and article-specific chat required of scheduled recommendations. It may not publish automatically. The owner reviews the full result and uses the normal Approve & Publish action.
