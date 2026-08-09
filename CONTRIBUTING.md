# Contributing

Contributions should preserve the project's central distinction: event facts are sourced; private chats are fictional satire.

Before opening a pull request:

```bash
npm test
npm run validate
npm run build
```

Do not submit generated political claims without checking the linked source. Do not add real-sounding private quotations, fabricated screenshots, unsupported accusations or jokes aimed at victims.

For a new live event, use the editorial issue workflow rather than editing `data/published-events.json` by hand. Direct data changes are reserved for corrections, migrations and maintenance and should include an audit-log entry.
