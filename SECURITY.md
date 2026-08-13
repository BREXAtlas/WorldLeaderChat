# Security and content-integrity reporting

Do not place credentials or private information in a public issue.

For ordinary factual errors, broken sources, unclear satire labeling or harmful jokes, use the repository's **Source correction or satire concern** issue form.

For a vulnerability that could permit unauthorized publishing, script injection, workflow-token abuse or disclosure of a secret, contact the repository owner privately through the security-reporting method configured in GitHub. Include the affected file or workflow, reproduction steps and impact. Avoid testing against the live site in a way that changes published content.

## Trust boundaries

- Feed content is untrusted and can only create draft issues.
- Issue bodies are untrusted until labels, actor permission and schema validation pass.
- Only HTTPS source URLs are accepted for approved events.
- Every rendered field is escaped before insertion into the page.
- The public Pages artifact excludes scripts, configuration and editorial logs.
- Workflows use explicit least-privilege permission blocks.
- Audience, supporter, payment and sponsor records live behind Postgres row-level security and server-side Edge Functions; they are never copied into the Pages artifact.
- Supabase service/secret keys, email transport keys and Stripe secrets are server-only. CI scans browser-delivered files for provider credentials and server-only variable names.
- Subscriber action URLs contain scoped, expiring, signed identifiers rather than raw email addresses.
