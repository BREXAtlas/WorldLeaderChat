# Duplicate publication guard

World Leader Chat treats repeated coverage of the same real-world event as one editorial file, even when multiple publishers use different headlines.

The guard has three layers:

1. News ingestion compares meaningful title terms inside a 36-hour window and collapses high-overlap cross-publisher coverage before issues are opened.
2. The editor locks a story immediately after **Approve & Publish** is submitted. The card changes to **Publishing…**, repeat approval is blocked, and the editor polls GitHub until the issue is marked published.
3. Publication remains idempotent by candidate fingerprint and source URL. If a past duplicate slips through, editorial data can be merged into one canonical event with all source links retained.

The August 9, 2026 Gaza-plan coverage was the first cleanup case: BBC News, Al Jazeera, and The Guardian reports are merged into one event instead of appearing as three separate chats.
