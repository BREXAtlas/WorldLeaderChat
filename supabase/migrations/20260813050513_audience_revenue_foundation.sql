-- World Leaders Chat Audience & Revenue Engine — Phase 1 foundation.
-- This migration is additive. It does not touch the existing JSON newsroom,
-- published article identifiers, editorial issues, or public URLs.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists wlc_private;
revoke all on schema wlc_private from public, anon, authenticated;

create or replace function wlc_private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.app_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'subscriber'
    check (role in ('public', 'subscriber', 'supporter', 'editor', 'owner', 'admin')),
  display_name text check (display_name is null or char_length(display_name) between 1 and 100),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function wlc_private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.app_profiles
    where user_id = (select auth.uid())
      and role in ('editor', 'owner', 'admin')
  );
$$;

revoke all on function wlc_private.is_staff() from public, anon;
grant usage on schema wlc_private to authenticated;
grant execute on function wlc_private.is_staff() to authenticated;

create table public.newsletter_subscribers (
  subscriber_id uuid primary key default gen_random_uuid(),
  email text not null check (
    email = lower(btrim(email))
    and char_length(email) between 3 and 320
    and email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  ),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'unsubscribed', 'bounced', 'suppressed')),
  source text not null default 'website' check (char_length(source) between 1 and 80),
  subscribed_at timestamptz not null default timezone('utc', now()),
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  preferences jsonb not null default '{"daily_group_chat":true,"product_updates":false,"open_tracking":false}'::jsonb
    check (jsonb_typeof(preferences) = 'object'),
  referral_code text not null default upper(substr(encode(gen_random_bytes(9), 'hex'), 1, 12))
    check (referral_code ~ '^[A-Z0-9]{8,24}$'),
  referred_by uuid references public.newsletter_subscribers(subscriber_id) on delete set null,
  last_delivery_at timestamptz,
  bounce_status text not null default 'none'
    check (bounce_status in ('none', 'soft', 'hard', 'complaint')),
  confirmation_token_hash text,
  confirmation_expires_at timestamptz,
  confirmation_sent_at timestamptz,
  acquisition_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(acquisition_metadata) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint newsletter_subscriber_lifecycle check (
    (status <> 'active' or confirmed_at is not null)
    and (status <> 'unsubscribed' or unsubscribed_at is not null)
  )
);

create unique index newsletter_subscribers_email_unique
  on public.newsletter_subscribers (lower(email));
create unique index newsletter_subscribers_referral_code_unique
  on public.newsletter_subscribers (referral_code);
create index newsletter_subscribers_status_created_idx
  on public.newsletter_subscribers (status, created_at desc);

create table public.newsletter_suppressions (
  suppression_id uuid primary key default gen_random_uuid(),
  email_hash text not null unique check (email_hash ~ '^[a-f0-9]{64}$'),
  reason text not null check (reason in ('unsubscribe', 'hard_bounce', 'complaint', 'manual', 'deletion')),
  provider_reference text,
  created_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz
);

create table public.sponsor_leads (
  lead_id uuid primary key default gen_random_uuid(),
  status text not null default 'new'
    check (status in ('new', 'contacted', 'proposal_sent', 'active', 'completed', 'declined')),
  name text not null check (char_length(name) between 1 and 120),
  company text not null check (char_length(company) between 1 and 160),
  email text not null check (char_length(email) between 3 and 320),
  phone text check (phone is null or char_length(phone) <= 40),
  company_website text not null check (company_website ~ '^https://'),
  campaign_goal text not null check (char_length(campaign_goal) between 3 and 1000),
  desired_placements text[] not null default '{}',
  target_start_date date,
  campaign_duration text check (campaign_duration is null or char_length(campaign_duration) <= 120),
  approximate_budget text check (approximate_budget is null or char_length(approximate_budget) <= 120),
  message text not null check (char_length(message) between 3 and 4000),
  source text not null default 'advertise_page',
  internal_notes text,
  contacted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.sponsors (
  sponsor_id uuid primary key default gen_random_uuid(),
  sponsor_type text not null default 'paid'
    check (sponsor_type in ('paid', 'house_promotion', 'network_promotion')),
  name text not null unique check (char_length(name) between 1 and 160),
  tagline text check (tagline is null or char_length(tagline) <= 280),
  logo_url text check (logo_url is null or logo_url ~ '^https://'),
  image_url text check (image_url is null or image_url ~ '^https://'),
  cta text check (cta is null or char_length(cta) <= 100),
  destination_url text not null check (destination_url ~ '^https://'),
  active boolean not null default true,
  internal_notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.sponsor_campaigns (
  campaign_id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.sponsors(sponsor_id) on delete restrict,
  lead_id uuid references public.sponsor_leads(lead_id) on delete set null,
  name text not null check (char_length(name) between 1 and 180),
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'active', 'paused', 'completed', 'declined')),
  cta text not null check (char_length(cta) between 1 and 100),
  destination_url text not null check (destination_url ~ '^https://'),
  start_at timestamptz,
  end_at timestamptz,
  active boolean not null default false,
  impression_goal bigint check (impression_goal is null or impression_goal >= 0),
  list_price numeric(12,2) check (list_price is null or list_price >= 0),
  agreed_price numeric(12,2) check (agreed_price is null or agreed_price >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  payment_status text not null default 'not_invoiced'
    check (payment_status in ('not_invoiced', 'invoiced', 'partial', 'paid', 'refunded', 'waived')),
  internal_notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint sponsor_campaign_dates check (end_at is null or start_at is null or end_at > start_at)
);

create table public.sponsor_placements (
  placement_id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.sponsor_campaigns(campaign_id) on delete cascade,
  placement text not null
    check (placement in ('site_sponsors', 'article_footer', 'desk', 'archive', 'daily_group_chat', 'social_carousel')),
  desk text,
  published_event_id text,
  newsletter_edition_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  configuration jsonb not null default '{}'::jsonb check (jsonb_typeof(configuration) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint sponsor_placement_dates check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table public.newsletter_editions (
  edition_id uuid primary key default gen_random_uuid(),
  edition_date date not null,
  slug text not null unique check (slug ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}(?:-[a-z0-9-]+)?$'),
  subject text not null check (char_length(subject) between 1 and 180),
  preheader text check (preheader is null or char_length(preheader) <= 280),
  status text not null default 'draft'
    check (status in ('draft', 'ready', 'scheduled', 'sending', 'sent', 'archived', 'cancelled')),
  editorial_window_start timestamptz not null,
  editorial_window_end timestamptz not null,
  sponsor_campaign_id uuid references public.sponsor_campaigns(campaign_id) on delete set null,
  scheduled_at timestamptz,
  sending_started_at timestamptz,
  sent_at timestamptz,
  public_at timestamptz,
  generated_at timestamptz not null default timezone('utc', now()),
  generated_from_commit text,
  html_body text,
  text_body text,
  owner_notes text,
  send_automatic boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint newsletter_editorial_window check (editorial_window_end > editorial_window_start),
  constraint newsletter_schedule_state check (
    status <> 'scheduled' or scheduled_at is not null
  ),
  constraint newsletter_sent_state check (
    status <> 'sent' or sent_at is not null
  )
);

alter table public.sponsor_placements
  add constraint sponsor_placements_newsletter_edition_fk
  foreign key (newsletter_edition_id) references public.newsletter_editions(edition_id) on delete set null;

create table public.newsletter_edition_items (
  item_id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.newsletter_editions(edition_id) on delete cascade,
  item_type text not null
    check (item_type in ('top_story', 'funniest_exchange', 'missed_story', 'carousel', 'complete_chat', 'sponsor')),
  position smallint not null check (position >= 0),
  published_event_id text,
  headline text not null check (char_length(headline) between 1 and 500),
  category text,
  summary text,
  story_url text not null check (story_url ~ '^https://worldleaders[.]chat/'),
  selected_messages jsonb not null default '[]'::jsonb check (jsonb_typeof(selected_messages) = 'array'),
  content_snapshot jsonb not null check (jsonb_typeof(content_snapshot) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (edition_id, item_type, position)
);

create unique index newsletter_edition_story_unique
  on public.newsletter_edition_items (edition_id, published_event_id)
  where published_event_id is not null and item_type <> 'sponsor';

create table public.newsletter_deliveries (
  delivery_id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.newsletter_editions(edition_id) on delete restrict,
  subscriber_id uuid not null references public.newsletter_subscribers(subscriber_id) on delete restrict,
  status text not null default 'queued'
    check (status in ('queued', 'sending', 'delivered', 'deferred', 'failed', 'bounced', 'complained', 'cancelled')),
  provider text,
  provider_message_id text,
  idempotency_key text not null check (char_length(idempotency_key) between 16 and 200),
  attempt_count smallint not null default 0 check (attempt_count between 0 and 20),
  next_attempt_at timestamptz,
  last_attempt_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  failure_code text,
  failure_detail text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (edition_id, subscriber_id),
  unique (idempotency_key)
);

create index newsletter_delivery_queue_idx
  on public.newsletter_deliveries (status, next_attempt_at, created_at)
  where status in ('queued', 'deferred');

create table public.newsletter_clicks (
  click_id uuid primary key default gen_random_uuid(),
  delivery_id uuid references public.newsletter_deliveries(delivery_id) on delete set null,
  edition_id uuid not null references public.newsletter_editions(edition_id) on delete cascade,
  subscriber_id uuid references public.newsletter_subscribers(subscriber_id) on delete set null,
  edition_item_id uuid references public.newsletter_edition_items(item_id) on delete set null,
  campaign_id uuid references public.sponsor_campaigns(campaign_id) on delete set null,
  redirect_id uuid not null default gen_random_uuid(),
  destination_url text not null check (destination_url ~ '^https://'),
  category text,
  clicked_at timestamptz not null default timezone('utc', now()),
  user_agent_family text,
  referrer_host text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  unique (redirect_id)
);

create index newsletter_clicks_edition_idx on public.newsletter_clicks (edition_id, clicked_at desc);
create index newsletter_clicks_campaign_idx on public.newsletter_clicks (campaign_id, clicked_at desc)
  where campaign_id is not null;

create table public.newsletter_referrals (
  referral_id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.newsletter_subscribers(subscriber_id) on delete cascade,
  referred_subscriber_id uuid not null references public.newsletter_subscribers(subscriber_id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'invalidated')),
  source text not null default 'referral_link',
  referred_at timestamptz not null default timezone('utc', now()),
  confirmed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  unique (referred_subscriber_id),
  check (referrer_id <> referred_subscriber_id)
);

create table public.supporter_plans (
  plan_id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_-]{2,80}$'),
  name text not null check (char_length(name) between 1 and 100),
  description text not null check (char_length(description) between 1 and 1000),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  monthly_amount_cents integer check (monthly_amount_cents is null or monthly_amount_cents >= 0),
  annual_amount_cents integer check (annual_amount_cents is null or annual_amount_cents >= 0),
  stripe_monthly_price_id text,
  stripe_annual_price_id text,
  benefits jsonb not null default '[]'::jsonb check (jsonb_typeof(benefits) = 'array'),
  active boolean not null default true,
  sort_order smallint not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.supporter_profiles (
  supporter_id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 100),
  stripe_customer_id text unique,
  status text not null default 'inactive'
    check (status in ('inactive', 'active', 'past_due', 'cancelled', 'deleted')),
  badges jsonb not null default '[]'::jsonb check (jsonb_typeof(badges) = 'array'),
  joined_at timestamptz,
  cancelled_at timestamptz,
  deletion_requested_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.supporter_subscriptions (
  subscription_id uuid primary key default gen_random_uuid(),
  supporter_id uuid not null references public.supporter_profiles(supporter_id) on delete cascade,
  plan_id uuid not null references public.supporter_plans(plan_id) on delete restrict,
  stripe_subscription_id text not null unique,
  billing_interval text not null check (billing_interval in ('month', 'year')),
  status text not null
    check (status in ('incomplete', 'trialing', 'active', 'past_due', 'unpaid', 'cancelled', 'paused')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  cancelled_at timestamptz,
  last_payment_at timestamptz,
  last_payment_failed_at timestamptz,
  provider_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(provider_payload) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.supporter_submissions (
  submission_id uuid primary key default gen_random_uuid(),
  supporter_id uuid references public.supporter_profiles(supporter_id) on delete set null,
  submission_type text not null
    check (submission_type in ('public_tip', 'story', 'news_link', 'participant', 'angle', 'headline', 'correction', 'idea')),
  status text not null default 'received'
    check (status in ('received', 'reviewing', 'accepted', 'declined', 'published')),
  source_url text check (source_url is null or source_url ~ '^https://'),
  second_source_url text check (second_source_url is null or second_source_url ~ '^https://'),
  submitter_email text check (submitter_email is null or char_length(submitter_email) <= 320),
  why_it_belongs text check (why_it_belongs is null or char_length(why_it_belongs) <= 4000),
  suggested_participants text[] not null default '{}',
  suggested_angle text check (suggested_angle is null or char_length(suggested_angle) <= 2000),
  suggested_headline text check (suggested_headline is null or char_length(suggested_headline) <= 500),
  idea text check (idea is null or char_length(idea) <= 4000),
  related_person text,
  category text,
  notes text check (notes is null or char_length(notes) <= 4000),
  editor_note text,
  editorial_issue_number bigint,
  published_event_id text,
  published_url text check (published_url is null or published_url ~ '^https://worldleaders[.]chat/'),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint supporter_submission_identity check (
    (submission_type = 'public_tip' and supporter_id is null)
    or (submission_type <> 'public_tip' and supporter_id is not null)
  )
);

create index supporter_submissions_queue_idx
  on public.supporter_submissions (status, created_at desc);

create table public.sponsor_impressions (
  impression_id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.sponsor_campaigns(campaign_id) on delete cascade,
  placement_id uuid references public.sponsor_placements(placement_id) on delete set null,
  newsletter_edition_id uuid references public.newsletter_editions(edition_id) on delete set null,
  published_event_id text,
  occurred_at timestamptz not null default timezone('utc', now()),
  session_hash text check (session_hash is null or session_hash ~ '^[a-f0-9]{64}$'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object')
);

create index sponsor_impressions_campaign_idx on public.sponsor_impressions (campaign_id, occurred_at desc);

create table public.sponsor_clicks (
  click_id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.sponsor_campaigns(campaign_id) on delete cascade,
  placement_id uuid references public.sponsor_placements(placement_id) on delete set null,
  newsletter_edition_id uuid references public.newsletter_editions(edition_id) on delete set null,
  published_event_id text,
  redirect_id uuid not null default gen_random_uuid() unique,
  destination_url text not null check (destination_url ~ '^https://'),
  clicked_at timestamptz not null default timezone('utc', now()),
  session_hash text check (session_hash is null or session_hash ~ '^[a-f0-9]{64}$'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object')
);

create index sponsor_clicks_campaign_idx on public.sponsor_clicks (campaign_id, clicked_at desc);

create table public.communication_preferences (
  preference_id uuid primary key default gen_random_uuid(),
  subscriber_id uuid unique references public.newsletter_subscribers(subscriber_id) on delete cascade,
  user_id uuid unique references auth.users(id) on delete cascade,
  daily_group_chat boolean not null default true,
  product_updates boolean not null default false,
  supporter_updates boolean not null default true,
  sponsor_messages boolean not null default false,
  open_tracking boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (subscriber_id is not null or user_id is not null)
);

create table public.deletion_requests (
  request_id uuid primary key default gen_random_uuid(),
  subscriber_id uuid references public.newsletter_subscribers(subscriber_id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  request_type text not null check (request_type in ('subscriber_data', 'supporter_account', 'all_data')),
  status text not null default 'received' check (status in ('received', 'verified', 'processing', 'completed', 'declined')),
  verification_token_hash text,
  verification_expires_at timestamptz,
  completed_at timestamptz,
  internal_notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (subscriber_id is not null or user_id is not null)
);

create table public.audit_events (
  audit_id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_role text,
  action text not null check (char_length(action) between 3 and 160),
  target_type text not null check (char_length(target_type) between 1 and 100),
  target_id text,
  request_id text,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default timezone('utc', now())
);

create index audit_events_target_idx on public.audit_events (target_type, target_id, created_at desc);
create index audit_events_actor_idx on public.audit_events (actor_user_id, created_at desc)
  where actor_user_id is not null;

create table public.request_rate_limits (
  bucket_id uuid primary key default gen_random_uuid(),
  endpoint text not null check (char_length(endpoint) between 1 and 100),
  subject_hash text not null check (subject_hash ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  blocked_until timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (endpoint, subject_hash, window_started_at)
);

create index request_rate_limits_cleanup_idx on public.request_rate_limits (window_started_at);

create or replace function public.consume_wlc_rate_limit(
  p_endpoint text,
  p_subject_hash text,
  p_window_started_at timestamptz,
  p_maximum integer,
  p_blocked_until timestamptz
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  resulting_count integer;
  resulting_blocked_until timestamptz;
begin
  if p_endpoint is null or char_length(p_endpoint) not between 1 and 100 then
    raise exception 'Invalid rate-limit endpoint';
  end if;
  if p_subject_hash is null or p_subject_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid rate-limit subject';
  end if;
  if p_maximum < 1 or p_maximum > 10000 then
    raise exception 'Invalid rate-limit maximum';
  end if;

  insert into public.request_rate_limits (
    endpoint, subject_hash, window_started_at, request_count, blocked_until
  ) values (
    p_endpoint, p_subject_hash, p_window_started_at, 1, null
  )
  on conflict (endpoint, subject_hash, window_started_at) do update
  set request_count = public.request_rate_limits.request_count + 1,
      blocked_until = case
        when public.request_rate_limits.blocked_until > timezone('utc', now())
          then public.request_rate_limits.blocked_until
        when public.request_rate_limits.request_count + 1 > p_maximum
          then p_blocked_until
        else null
      end
  returning request_count, blocked_until
  into resulting_count, resulting_blocked_until;

  return resulting_count <= p_maximum
    and (resulting_blocked_until is null or resulting_blocked_until <= timezone('utc', now()));
end;
$$;

revoke all on function public.consume_wlc_rate_limit(text, text, timestamptz, integer, timestamptz)
  from public, anon, authenticated;
grant execute on function public.consume_wlc_rate_limit(text, text, timestamptz, integer, timestamptz)
  to service_role;

insert into public.supporter_plans (
  code, name, description, monthly_amount_cents, annual_amount_cents, benefits, sort_order
) values (
  'supporter',
  'SUPPORTER',
  'Join the room and help decide which stories deserve a chat.',
  500,
  5000,
  '["Submit article and story candidates","Suggest participants, angles and headlines","Vote on proposed ideas","Save favorite articles","Track submission status","Earn community badges"]'::jsonb,
  10
) on conflict (code) do nothing;

insert into public.sponsors (sponsor_type, name, tagline, cta, destination_url, internal_notes)
values
  ('house_promotion', 'EdNotebook', 'It’s your semester, own it.', 'Explore EdNotebook →', 'https://ednotebook.com', 'Existing World Leaders Chat house promotion; do not describe as paid without an agreement.'),
  ('network_promotion', 'Outbreak Tracker', 'Track outbreaks, timelines and public-health developments.', 'Open Outbreak Tracker →', 'https://outbreak-atlas-cyclospora.magazinebeaucoup.chatgpt.site/', 'Existing network promotion; public live website only.')
on conflict (name) do update
set sponsor_type = excluded.sponsor_type,
    tagline = excluded.tagline,
    cta = excluded.cta,
    destination_url = excluded.destination_url,
    internal_notes = excluded.internal_notes,
    updated_at = timezone('utc', now());

-- All audience and revenue tables are deny-by-default. Public write operations
-- are accepted only by validated Edge Functions using the server-only key.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'app_profiles',
    'newsletter_subscribers',
    'newsletter_suppressions',
    'newsletter_editions',
    'newsletter_edition_items',
    'newsletter_deliveries',
    'newsletter_clicks',
    'newsletter_referrals',
    'supporter_profiles',
    'supporter_plans',
    'supporter_subscriptions',
    'supporter_submissions',
    'sponsor_leads',
    'sponsors',
    'sponsor_campaigns',
    'sponsor_placements',
    'sponsor_impressions',
    'sponsor_clicks',
    'communication_preferences',
    'deletion_requests',
    'audit_events',
    'request_rate_limits'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on table public.%I to service_role', table_name);
  end loop;
end;
$$;

create policy supporter_plans_public_read
on public.supporter_plans for select
to anon
using (active = true);
grant select on public.supporter_plans to anon, authenticated;

create policy supporter_plans_authenticated_read
on public.supporter_plans for select
to authenticated
using (active = true or (select wlc_private.is_staff()));

create policy app_profiles_self_read
on public.app_profiles for select
to authenticated
using (user_id = (select auth.uid()) or (select wlc_private.is_staff()));
grant select on public.app_profiles to authenticated;

create policy supporter_profiles_self_read
on public.supporter_profiles for select
to authenticated
using (user_id = (select auth.uid()) or (select wlc_private.is_staff()));
grant select on public.supporter_profiles to authenticated;

create policy supporter_subscriptions_self_read
on public.supporter_subscriptions for select
to authenticated
using (exists (
  select 1 from public.supporter_profiles profile
  where profile.supporter_id = supporter_subscriptions.supporter_id
    and profile.user_id = (select auth.uid())
) or (select wlc_private.is_staff()));
grant select on public.supporter_subscriptions to authenticated;

create policy supporter_submissions_self_read
on public.supporter_submissions for select
to authenticated
using (exists (
  select 1 from public.supporter_profiles profile
  where profile.supporter_id = supporter_submissions.supporter_id
    and profile.user_id = (select auth.uid())
) or (select wlc_private.is_staff()));
grant select on public.supporter_submissions to authenticated;

create policy communication_preferences_self_read
on public.communication_preferences for select
to authenticated
using (user_id = (select auth.uid()) or (select wlc_private.is_staff()));
grant select on public.communication_preferences to authenticated;

create policy request_rate_limits_deny_anon
on public.request_rate_limits for all
to anon
using (false)
with check (false);

create policy request_rate_limits_deny_authenticated
on public.request_rate_limits for all
to authenticated
using (false)
with check (false);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'newsletter_subscribers',
    'newsletter_suppressions',
    'newsletter_editions',
    'newsletter_edition_items',
    'newsletter_deliveries',
    'newsletter_clicks',
    'newsletter_referrals',
    'sponsor_leads',
    'sponsors',
    'sponsor_campaigns',
    'sponsor_placements',
    'sponsor_impressions',
    'sponsor_clicks',
    'deletion_requests'
  ] loop
    execute format(
      'create policy %I on public.%I for all to authenticated using ((select wlc_private.is_staff())) with check ((select wlc_private.is_staff()))',
      table_name || '_staff_all',
      table_name
    );
    execute format('grant select, insert, update, delete on table public.%I to authenticated', table_name);
  end loop;
end;
$$;

create policy audit_events_staff_read
on public.audit_events for select
to authenticated
using ((select wlc_private.is_staff()));

create policy audit_events_staff_insert
on public.audit_events for insert
to authenticated
with check ((select wlc_private.is_staff()));

grant select, insert on public.audit_events to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'app_profiles',
    'supporter_profiles',
    'supporter_plans',
    'supporter_subscriptions',
    'supporter_submissions',
    'communication_preferences'
  ] loop
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select wlc_private.is_staff()))',
      table_name || '_staff_insert',
      table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select wlc_private.is_staff())) with check ((select wlc_private.is_staff()))',
      table_name || '_staff_update',
      table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select wlc_private.is_staff()))',
      table_name || '_staff_delete',
      table_name
    );
    execute format('grant select, insert, update, delete on table public.%I to authenticated', table_name);
  end loop;
end;
$$;

-- The self-read policies above remain the only path for ordinary authenticated
-- users; the broad table grants are still constrained by RLS and staff checks.

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'app_profiles',
    'newsletter_subscribers',
    'sponsor_leads',
    'sponsors',
    'sponsor_campaigns',
    'sponsor_placements',
    'newsletter_editions',
    'newsletter_edition_items',
    'newsletter_deliveries',
    'supporter_plans',
    'supporter_profiles',
    'supporter_subscriptions',
    'supporter_submissions',
    'communication_preferences',
    'deletion_requests',
    'request_rate_limits'
  ] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function wlc_private.set_updated_at()',
      table_name || '_set_updated_at',
      table_name
    );
  end loop;
end;
$$;

comment on table public.newsletter_subscribers is 'World Leaders Chat-owned newsletter audience. Never export to the public Pages artifact.';
comment on table public.newsletter_deliveries is 'One row per subscriber and edition; the unique pair is the duplicate-send safety boundary.';
comment on table public.supporter_submissions is 'Public tips and supporter proposals; accepted records convert into the existing GitHub editorial pipeline.';
comment on table public.sponsors is 'Paid sponsors, house promotions and network promotions; classification prevents false paid-sponsor claims.';
comment on table public.audit_events is 'Append-only administrator action trail for audience, supporter and sponsor operations.';
