import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import {
  allowedOrigin,
  cleanPreferences,
  confirmationMessage,
  createSignedToken,
  maskedEmail,
  normalizeEmail,
  sha256,
  verifySignedToken
} from "../../supabase/functions/_shared/audience-core.js";

const secret = "test-only-signing-secret-with-more-than-32-characters";

test("newsletter signup normalization rejects malformed and header-injection email addresses", () => {
  assert.equal(normalizeEmail("  Reader@Example.COM "), "reader@example.com");
  assert.throws(() => normalizeEmail("not-an-email"), /valid email/i);
  assert.throws(() => normalizeEmail("reader@example.com\nBcc:x@example.com"), /valid email/i);
});

test("subscriber action tokens are signed, scoped, expiring and contain no raw email", async () => {
  const subscriberId = "123e4567-e89b-12d3-a456-426614174000";
  const token = await createSignedToken({
    subscriberId,
    scope: "confirm",
    expiresAt: Date.now() + 60_000,
    nonce: "single-use-test-nonce"
  }, secret);
  assert.equal(token.includes("reader@example.com"), false);
  assert.equal((await verifySignedToken(token, secret, "confirm")).sub, subscriberId);
  await assert.rejects(() => verifySignedToken(token, secret, "unsubscribe"), /cannot be used/i);
  await assert.rejects(() => verifySignedToken(token.replace(/.$/, "x"), secret, "confirm"), /invalid/i);
  await assert.rejects(() => verifySignedToken(token, secret, "confirm", Date.now() + 120_000), /expired/i);
  assert.match(await sha256(token), /^[a-f0-9]{64}$/);
});

test("confirmation transport is branded and provides text and accessible HTML variants", () => {
  const message = confirmationMessage({ confirmUrl: "https://worldleaders.chat/subscribe/confirm/?token=opaque" });
  assert.match(message.subject, /THE DAILY GROUP CHAT/);
  assert.match(message.text, /Confirm your subscription/);
  assert.match(message.html, /WORLD LEADERS CHAT/);
  assert.match(message.html, /CONFIRM &amp; JOIN THE CHAT/);
});

test("preference and privacy helpers disclose no raw subscriber email", () => {
  assert.deepEqual(cleanPreferences({ daily_group_chat: false, product_updates: true, open_tracking: false }), {
    daily_group_chat: false,
    product_updates: true,
    open_tracking: false
  });
  assert.equal(maskedEmail("reader@example.com").includes("reader@example.com"), false);
  assert.equal(allowedOrigin("https://worldleaders.chat"), true);
  assert.equal(allowedOrigin("https://evil.example"), false);
});

test("foundation migration creates the owned system of record and duplicate-send boundary", async () => {
  const directory = new URL("../../supabase/migrations/", import.meta.url);
  const files = (await readdir(directory)).filter((file) => file.endsWith(".sql"));
  const sql = (await Promise.all(files.map((file) => readFile(new URL(file, directory), "utf8")))).join("\n");
  for (const table of [
    "newsletter_subscribers", "newsletter_editions", "newsletter_edition_items", "newsletter_deliveries",
    "newsletter_clicks", "newsletter_referrals", "supporter_profiles", "supporter_plans",
    "supporter_subscriptions", "supporter_submissions", "sponsor_leads", "sponsors", "sponsor_campaigns",
    "sponsor_placements", "sponsor_impressions", "sponsor_clicks", "communication_preferences", "audit_events"
  ]) assert.match(sql, new RegExp(`create table public\\.${table}\\b`, "i"));
  assert.match(sql, /unique \(edition_id, subscriber_id\)/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /revoke all on table/i);
  assert.match(sql, /EdNotebook', 'It’s your semester, own it\.'/);
  assert.match(sql, /'network_promotion', 'Outbreak Tracker'/);
});

test("public audience API uses only IDs in subscriber responses and keeps server credentials in the function", async () => {
  const api = await readFile(new URL("../../supabase/functions/audience-api/index.ts", import.meta.url), "utf8");
  const core = await readFile(new URL("../../supabase/functions/_shared/audience-core.js", import.meta.url), "utf8");
  assert.match(api, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(api, /newsletter_suppressions/);
  assert.match(api, /consume_wlc_rate_limit/);
  assert.match(api, /confirmation_token_hash/);
  assert.match(api, /preferences_token/);
  assert.doesNotMatch(core.match(/function publicSubscriberResponse[\s\S]*?\n}/)?.[0] || "", /email\s*:/i);
});
