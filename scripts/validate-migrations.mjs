import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const migrationDirectory = resolve(root, "supabase/migrations");
const files = (await readdir(migrationDirectory)).filter((file) => file.endsWith(".sql")).sort();
const errors = [];

if (!files.length) errors.push("At least one versioned Supabase migration is required.");
for (const file of files) {
  if (!/^\d{14}_[a-z0-9_]+[.]sql$/.test(file)) errors.push(`Invalid migration filename: ${file}`);
}

const sql = (await Promise.all(files.map((file) => readFile(resolve(migrationDirectory, file), "utf8")))).join("\n").toLowerCase();
const requiredTables = [
  "newsletter_subscribers",
  "newsletter_editions",
  "newsletter_edition_items",
  "newsletter_deliveries",
  "newsletter_clicks",
  "newsletter_referrals",
  "supporter_profiles",
  "supporter_plans",
  "supporter_subscriptions",
  "supporter_submissions",
  "sponsor_leads",
  "sponsors",
  "sponsor_campaigns",
  "sponsor_placements",
  "sponsor_impressions",
  "sponsor_clicks",
  "communication_preferences",
  "audit_events"
];

for (const table of requiredTables) {
  if (!sql.includes(`create table public.${table}`)) errors.push(`Missing required table migration: ${table}`);
  if (!sql.includes(`'${table}'`)) errors.push(`Missing deny-by-default RLS registration: ${table}`);
}

const requiredSafeguards = [
  ["unique (edition_id, subscriber_id)", "newsletter duplicate-send uniqueness"],
  ["confirmation_token_hash", "hashed newsletter confirmation tokens"],
  ["newsletter_suppressions", "newsletter suppression list"],
  ["request_rate_limits", "first-party request rate limiting"],
  ["consume_wlc_rate_limit", "atomic rate-limit enforcement"],
  ["to service_role", "explicit server-only Data API grants"],
  ["enable row level security", "row-level security"],
  ["revoke all on table", "explicit Data API privilege revocation"],
  ["wlc_private.is_staff", "database-backed staff authorization"],
  ["house_promotion", "house-promotion sponsor classification"],
  ["network_promotion", "network-promotion sponsor classification"],
  ["it’s your semester, own it.", "exact EdNotebook tagline"]
];

for (const [needle, description] of requiredSafeguards) {
  if (!sql.includes(needle)) errors.push(`Missing migration safeguard: ${description}`);
}

const clickSections = ["newsletter_clicks", "sponsor_clicks"].map((table, index, tables) => {
  const start = sql.indexOf(`create table public.${table}`);
  const later = tables.slice(index + 1).map((candidate) => sql.indexOf(`create table public.${candidate}`)).filter((position) => position > start);
  const end = later.length ? Math.min(...later) : sql.indexOf("create table", start + 20);
  return sql.slice(start, end > start ? end : undefined);
});
if (clickSections.some((section) => /\bemail\b/.test(section))) {
  errors.push("Click-tracking tables must not contain raw email fields.");
}

if (errors.length) {
  console.error("Migration validation failed:\n- " + errors.join("\n- "));
  process.exitCode = 1;
} else {
  console.log(`Migration validation passed (${files.length} migration(s), ${requiredTables.length} required tables).`);
}
