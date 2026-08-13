# World Leaders Chat Audience & Revenue Engine

## Repository audit and decision

The existing production application remains the product shell and publishing system:

- GitHub Pages serves the static newsroom at `https://worldleaders.chat/`.
- `index.html` contains the historical archive and `data/published-events.json` contains the editor-approved rolling publication data.
- GitHub issues and Actions are the editorial candidate, drafting, approval and publishing workflow.
- `/editor/` is the existing private editorial surface. It currently talks to the GitHub API with an owner-supplied, write-capable token kept in `sessionStorage`.
- `social-card-export.js` owns the single PNG and complete carousel export path; `social-tools.js` owns copy/share behavior.
- EdNotebook and Outbreak Tracker are existing sponsor-area promotions.
- The repository had no database, account system, payment provider, email provider or first-party audience analytics before this foundation.

Static Pages cannot safely receive subscriptions, store private supporter/sponsor records, validate payment webhooks or send email. The smallest additive backend is one dedicated Supabase project containing Postgres, Auth and Edge Functions. GitHub Pages remains the public frontend, and the existing GitHub issue workflow remains the only article publishing pipeline.

No public UX changes are part of Phase 1.

## System boundaries

| Boundary | Responsibility |
|---|---|
| GitHub Pages | Existing newsroom, archives, article/chat viewer, social exports and future branded audience pages |
| GitHub issues/Actions | Existing news ingestion, drafting, approval, publication and Pages deployment |
| WLC Postgres | Newsletter subscribers/editions/deliveries, supporter entitlements/submissions, sponsors/campaigns, preferences, analytics identifiers and audit events |
| WLC Edge Functions | Validation, rate limits, signed subscriber actions, email transport calls, Auth-aware supporter operations, Stripe webhooks and privileged editor operations |
| Resend or SES | Email transport only; never the subscriber system of record |
| Stripe | Checkout, recurring billing and payment events only; never the entitlement system of record |

Published article IDs remain the stable join key. Audience tables may store `published_event_id` and an immutable content snapshot, but migrations do not change the newsroom JSON contract or article IDs.

## Phase 1 schema

The first migration creates all requested owned-data tables plus a few narrow security/operations tables:

- Newsletter: `newsletter_subscribers`, `newsletter_editions`, `newsletter_edition_items`, `newsletter_deliveries`, `newsletter_clicks`, `newsletter_referrals`, `newsletter_suppressions`.
- Supporters: `app_profiles`, `supporter_profiles`, `supporter_plans`, `supporter_subscriptions`, `supporter_submissions`.
- Sponsors: `sponsor_leads`, `sponsors`, `sponsor_campaigns`, `sponsor_placements`, `sponsor_impressions`, `sponsor_clicks`.
- Shared: `communication_preferences`, `deletion_requests`, `audit_events`, `request_rate_limits`.

Database invariants provide the final safety boundary:

- One `newsletter_deliveries` row per edition/subscriber pair prevents accidental duplicate sends.
- Subscriber confirmation tokens are stored only as SHA-256 hashes and expire after 24 hours.
- Click rows use opaque UUIDs and IDs; click tables have no raw email field.
- Supporter entitlement/billing fields cannot be changed through ordinary authenticated RLS access.
- Roles come from `app_profiles`, not user-editable Auth metadata.
- All tables have RLS enabled and explicit grants. The public can read only active supporter plans.
- Server operations use an explicitly granted `service_role`; no service/secret key belongs in Pages output.
- A privileged atomic rate-limit function is executable only by `service_role`.

The seed is intentionally factual:

- `SUPPORTER`: configurable default of $5/month or $50/year, stored once in `supporter_plans`.
- EdNotebook: `house_promotion`, with the exact tagline “It’s your semester, own it.” and `https://ednotebook.com`.
- Outbreak Tracker: `network_promotion`, linked only to its public live site.

## Subscriber API foundation

The `audience-api` Edge Function provides server-side routes for:

- `POST newsletter/signup`
- `GET|POST newsletter/confirm`
- `POST newsletter/unsubscribe`
- `GET|PUT newsletter/preferences`
- `GET health`

Signup behavior is deliberately enumeration-resistant. Active, suppressed and rate-limited addresses receive the same neutral response. The function normalizes/validates input, checks a honeypot, applies an atomic IP limit and a stricter address-level email-bombing limit, checks the suppression list, stores only a pending subscriber, hashes the one-time confirmation token and asks Resend to transport the branded confirmation message.

Confirmation, preference and unsubscribe links contain a subscriber UUID, scope, expiry, nonce and HMAC signature. They never contain an email address. Newsletter composition and audience state never move into Resend.

## Auth and roles

Supabase Auth will provide email magic links for supporter accounts. Authorization is database-backed:

- `public`: no account
- `subscriber`: confirmed newsletter relationship or ordinary account
- `supporter`: server-verified active entitlement
- `editor`: newsroom/audience staff
- `owner` / `admin`: full audience and revenue control

Stripe webhook processing—not browser claims—will activate, fail, cancel or restore supporter entitlement in Phase 3. Supporter proposals always land in `supporter_submissions`; acceptance will create a candidate in the existing GitHub editorial workflow rather than a second publishing system.

## Environment contract

Public Pages configuration:

- `WLC_SITE_URL`
- `WLC_SUPABASE_URL`
- `WLC_SUPABASE_PUBLISHABLE_KEY`

Server-only Edge Function secrets:

- `WLC_TOKEN_SIGNING_SECRET`
- `WLC_RATE_LIMIT_SECRET`
- `RESEND_API_KEY`
- `NEWSLETTER_FROM_EMAIL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_SUPPORTER_MONTHLY`
- `STRIPE_PRICE_SUPPORTER_ANNUAL`
- `WLC_GITHUB_TOKEN`
- `WLC_GITHUB_REPOSITORY`

Supabase supplies its URL and server key to hosted Edge Functions. Neither `SUPABASE_SERVICE_ROLE_KEY` nor a Supabase secret key may be copied into GitHub Pages, source-controlled values or browser code.

## Migration and recovery

Before Phase 1 work, production `main` was tagged at `f213f03082de7910e2723d33a45f99f8735ac6e2` as `audience-revenue-pre-migration-20260813` and pushed to GitHub. The migration is additive and contains no statements against published event JSON or editorial data.

CI now performs:

1. JavaScript/TypeScript syntax checks.
2. Unit tests and newsroom contract tests.
3. Repository, migration and environment-contract validation.
4. Dependency/credential-exposure checks.
5. Static Pages build.
6. A clean local Supabase start and migration reset.
7. Database RLS/role/idempotency integration tests.
8. Supabase SQL lint plus security and performance advisors.

Production migrations must be applied from the committed migration history. Never hand-edit production tables in the dashboard without a corresponding migration.
