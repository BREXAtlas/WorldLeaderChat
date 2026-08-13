begin;

insert into auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at)
values
  ('11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'supporter-test@example.com', now(), now(), now()),
  ('22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'owner-test@example.com', now(), now(), now());

insert into public.app_profiles (user_id, role, display_name)
values
  ('11111111-1111-4111-8111-111111111111', 'supporter', 'Test Supporter'),
  ('22222222-2222-4222-8222-222222222222', 'owner', 'Test Owner');

insert into public.supporter_profiles (supporter_id, user_id, status, joined_at)
values ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'active', now());

do $$
begin
  if has_function_privilege(
    'anon',
    'public.consume_wlc_rate_limit(text,text,timestamp with time zone,integer,timestamp with time zone)',
    'EXECUTE'
  ) then raise exception 'Anonymous callers can execute the privileged rate-limit function'; end if;
  if not has_function_privilege(
    'service_role',
    'public.consume_wlc_rate_limit(text,text,timestamp with time zone,integer,timestamp with time zone)',
    'EXECUTE'
  ) then raise exception 'Service role cannot execute the rate-limit function'; end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);

do $$
declare
  visible_profiles integer;
  visible_sponsors integer;
  visible_plans integer;
  affected_rows integer;
begin
  select count(*) into visible_profiles from public.app_profiles;
  select count(*) into visible_sponsors from public.sponsors;
  select count(*) into visible_plans from public.supporter_plans;
  if visible_profiles <> 1 then raise exception 'Supporter should see exactly one app profile, saw %', visible_profiles; end if;
  if visible_sponsors <> 0 then raise exception 'Supporter must not read sponsor records'; end if;
  if visible_plans <> 1 then raise exception 'Supporter should see the active plan'; end if;
  if (select wlc_private.is_staff()) then raise exception 'Supporter was incorrectly authorized as staff'; end if;

  begin
    update public.supporter_profiles set status = 'active'
    where user_id = '11111111-1111-4111-8111-111111111111';
    get diagnostics affected_rows = row_count;
    if affected_rows <> 0 then raise exception 'Supporter was allowed to mutate entitlement state'; end if;
  exception when insufficient_privilege then
    null;
  end;

  begin
    insert into public.sponsors (name, sponsor_type, destination_url)
    values ('Unauthorized Sponsor', 'paid', 'https://example.com');
    raise exception 'Supporter was allowed to create a sponsor';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);

do $$
declare
  visible_profiles integer;
  visible_sponsors integer;
begin
  if not (select wlc_private.is_staff()) then raise exception 'Owner was not authorized as staff'; end if;
  select count(*) into visible_profiles from public.app_profiles;
  select count(*) into visible_sponsors from public.sponsors;
  if visible_profiles <> 2 then raise exception 'Owner should see all app profiles'; end if;
  if visible_sponsors <> 2 then raise exception 'Owner should see both seeded promotions'; end if;
  insert into public.sponsors (name, sponsor_type, destination_url)
  values ('Owner Test Sponsor', 'paid', 'https://example.com');
end;
$$;

reset role;

insert into public.newsletter_subscribers (
  subscriber_id, email, status, confirmed_at, referral_code
) values (
  '44444444-4444-4444-8444-444444444444', 'delivery-test@example.com', 'active', now(), 'DELIVERYTEST'
);

insert into public.newsletter_editions (
  edition_id, edition_date, slug, subject, editorial_window_start, editorial_window_end
) values (
  '55555555-5555-4555-8555-555555555555', current_date, to_char(current_date, 'YYYY-MM-DD'),
  'THE DAILY GROUP CHAT: Test', now() - interval '1 day', now()
);

insert into public.newsletter_deliveries (
  edition_id, subscriber_id, idempotency_key
) values (
  '55555555-5555-4555-8555-555555555555',
  '44444444-4444-4444-8444-444444444444',
  'edition-5555-subscriber-4444'
);

do $$
begin
  begin
    insert into public.newsletter_deliveries (edition_id, subscriber_id, idempotency_key)
    values (
      '55555555-5555-4555-8555-555555555555',
      '44444444-4444-4444-8444-444444444444',
      'different-key-same-edition-subscriber'
    );
    raise exception 'Duplicate edition delivery was accepted';
  exception when unique_violation then
    null;
  end;
end;
$$;

set local role service_role;
do $$
declare
  first_request boolean;
  second_request boolean;
  third_request boolean;
begin
  select public.consume_wlc_rate_limit('integration_test', repeat('a', 64), date_trunc('hour', now()), 2, now() + interval '1 hour') into first_request;
  select public.consume_wlc_rate_limit('integration_test', repeat('a', 64), date_trunc('hour', now()), 2, now() + interval '1 hour') into second_request;
  select public.consume_wlc_rate_limit('integration_test', repeat('a', 64), date_trunc('hour', now()), 2, now() + interval '1 hour') into third_request;
  if not first_request or not second_request or third_request then
    raise exception 'Atomic rate limit did not permit two requests and block the third';
  end if;
end;
$$;
reset role;

rollback;
