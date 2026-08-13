import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import {
  allowedOrigin,
  cleanPreferences,
  cleanReferralCode,
  cleanSource,
  confirmationMessage,
  corsHeaders,
  createSignedToken,
  hasBotField,
  maskedEmail,
  normalizeEmail,
  publicSubscriberResponse,
  sha256,
  verifySignedToken
} from "../_shared/audience-core.js";

const SITE_URL = (Deno.env.get("WLC_SITE_URL") || "https://worldleaders.chat").replace(/\/$/, "");
const TOKEN_SECRET = Deno.env.get("WLC_TOKEN_SIGNING_SECRET") || "";
const RATE_SECRET = Deno.env.get("WLC_RATE_LIMIT_SECRET") || TOKEN_SECRET;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FROM_EMAIL = Deno.env.get("NEWSLETTER_FROM_EMAIL") || "THE DAILY GROUP CHAT <daily@worldleaders.chat>";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY") || "";

function json(origin, body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      ...headers
    }
  });
}

function fail(origin, status, message) {
  return json(origin, { error: message }, status);
}

function assertConfigured(names = []) {
  const values = {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
    WLC_TOKEN_SIGNING_SECRET: TOKEN_SECRET,
    WLC_RATE_LIMIT_SECRET: RATE_SECRET,
    RESEND_API_KEY,
    NEWSLETTER_FROM_EMAIL: FROM_EMAIL
  };
  const missing = names.filter((name) => !values[name]);
  if (TOKEN_SECRET.length < 32 || RATE_SECRET.length < 32) missing.push("secure signing secrets");
  if (missing.length) throw new Error(`Server configuration is incomplete: ${[...new Set(missing)].join(", ")}`);
}

async function requestBody(request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 16_384) throw new Error("Request body is too large.");
  const text = await request.text();
  if (text.length > 16_384) throw new Error("Request body is too large.");
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
}

function routeOf(url) {
  const path = new URL(url).pathname.replace(/^.*\/audience-api\/?/, "").replace(/^\/+|\/+$/g, "");
  return path || "health";
}

async function consumeRateLimit(admin, endpoint, subject, maximum, minutes) {
  const now = new Date();
  const windowStart = new Date(Math.floor(now.getTime() / (minutes * 60_000)) * minutes * 60_000).toISOString();
  const subjectHash = await sha256(`${RATE_SECRET}:${subject}`);
  const { data, error } = await admin.rpc("consume_wlc_rate_limit", {
    p_endpoint: endpoint,
    p_subject_hash: subjectHash,
    p_window_started_at: windowStart,
    p_maximum: maximum,
    p_blocked_until: new Date(now.getTime() + minutes * 60_000).toISOString()
  });
  if (error) throw error;
  return data === true;
}

async function audit(admin, action, targetType, targetId, metadata = {}) {
  const { error } = await admin.from("audit_events").insert({
    action,
    target_type: targetType,
    target_id: targetId,
    metadata
  });
  if (error) console.error("Audit insert failed", error.code);
}

async function sendConfirmation(email, subscriberId, token) {
  const confirmUrl = `${SITE_URL}/subscribe/confirm/?token=${encodeURIComponent(token)}`;
  const message = confirmationMessage({ confirmUrl });
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `wlc-confirm-${subscriberId}-${await sha256(token)}`
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: [email], subject: message.subject, html: message.html, text: message.text })
  });
  if (!response.ok) throw new Error(`Email transport returned ${response.status}.`);
}

async function newsletterSignup(request, origin, admin) {
  if (request.method !== "POST") return fail(origin, 405, "Method not allowed.");
  if (!allowedOrigin(origin)) return fail(origin, 403, "Origin not allowed.");
  assertConfigured(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "WLC_TOKEN_SIGNING_SECRET", "WLC_RATE_LIMIT_SECRET", "RESEND_API_KEY"]);
  const body = await requestBody(request);
  if (hasBotField(body)) return json(origin, publicSubscriberResponse(), 202);
  const email = normalizeEmail(body.email);
  const source = cleanSource(body.source);
  const ip = String(request.headers.get("x-forwarded-for") || request.headers.get("cf-connecting-ip") || "unknown").split(",")[0].trim();
  const [ipAllowed, emailAllowed] = await Promise.all([
    consumeRateLimit(admin, "newsletter_signup_ip", ip, 10, 60),
    consumeRateLimit(admin, "newsletter_signup_email", email, 2, 24 * 60)
  ]);
  if (!ipAllowed || !emailAllowed) return json(origin, publicSubscriberResponse(), 202);

  const emailHash = await sha256(email);
  const { data: suppression, error: suppressionError } = await admin
    .from("newsletter_suppressions")
    .select("suppression_id")
    .eq("email_hash", emailHash)
    .maybeSingle();
  if (suppressionError) throw suppressionError;
  if (suppression) return json(origin, publicSubscriberResponse(), 202);

  const { data: existing, error: existingError } = await admin
    .from("newsletter_subscribers")
    .select("subscriber_id,status")
    .eq("email", email)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing?.status === "active" || existing?.status === "suppressed" || existing?.status === "bounced") {
    return json(origin, publicSubscriberResponse(), 202);
  }

  let referredBy = null;
  const referralCode = cleanReferralCode(body.ref);
  if (referralCode) {
    const { data: referrer } = await admin
      .from("newsletter_subscribers")
      .select("subscriber_id")
      .eq("referral_code", referralCode)
      .eq("status", "active")
      .maybeSingle();
    referredBy = referrer?.subscriber_id || null;
  }

  const subscriberId = existing?.subscriber_id || crypto.randomUUID();
  const confirmationExpiresAt = Date.now() + 24 * 60 * 60 * 1000;
  const token = await createSignedToken({ subscriberId, scope: "confirm", expiresAt: confirmationExpiresAt }, TOKEN_SECRET);
  const confirmationTokenHash = await sha256(token);
  const values = {
    subscriber_id: subscriberId,
    email,
    status: "pending",
    source,
    preferences: cleanPreferences(body.preferences),
    referred_by: referredBy,
    confirmation_token_hash: confirmationTokenHash,
    confirmation_expires_at: new Date(confirmationExpiresAt).toISOString(),
    confirmation_sent_at: new Date().toISOString(),
    unsubscribed_at: null,
    acquisition_metadata: { ref: referralCode || null }
  };
  const write = existing
    ? admin.from("newsletter_subscribers").update(values).eq("subscriber_id", subscriberId)
    : admin.from("newsletter_subscribers").insert(values);
  const { error: writeError } = await write;
  if (writeError) throw writeError;

  const { error: preferenceError } = await admin.from("communication_preferences").upsert({
    subscriber_id: subscriberId,
    daily_group_chat: values.preferences.daily_group_chat,
    product_updates: values.preferences.product_updates,
    open_tracking: values.preferences.open_tracking
  }, { onConflict: "subscriber_id" });
  if (preferenceError) throw preferenceError;

  if (referredBy && referredBy !== subscriberId) {
    const { error: referralError } = await admin.from("newsletter_referrals").upsert({
      referrer_id: referredBy,
      referred_subscriber_id: subscriberId,
      status: "pending",
      source: "referral_link"
    }, { onConflict: "referred_subscriber_id", ignoreDuplicates: true });
    if (referralError) throw referralError;
  }

  await sendConfirmation(email, subscriberId, token);
  await audit(admin, "newsletter.signup_requested", "newsletter_subscriber", subscriberId, { source, referred: Boolean(referredBy) });
  return json(origin, publicSubscriberResponse(), 202);
}

async function newsletterConfirm(request, origin, admin) {
  if (!new Set(["GET", "POST"]).has(request.method)) return fail(origin, 405, "Method not allowed.");
  assertConfigured(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "WLC_TOKEN_SIGNING_SECRET"]);
  const body = request.method === "POST" ? await requestBody(request) : {};
  const token = body.token || new URL(request.url).searchParams.get("token") || "";
  const claims = await verifySignedToken(token, TOKEN_SECRET, "confirm");
  const tokenHash = await sha256(token);
  const now = new Date().toISOString();
  const { data: subscriber, error: subscriberError } = await admin
    .from("newsletter_subscribers")
    .select("subscriber_id,status,email,referral_code,confirmation_token_hash,confirmation_expires_at")
    .eq("subscriber_id", claims.sub)
    .maybeSingle();
  if (subscriberError) throw subscriberError;
  if (!subscriber || subscriber.confirmation_token_hash !== tokenHash || new Date(subscriber.confirmation_expires_at) <= new Date()) {
    return fail(origin, 400, "This confirmation link is invalid or expired.");
  }
  if (subscriber.status !== "active") {
    const { data: updated, error: updateError } = await admin.from("newsletter_subscribers").update({
      status: "active",
      confirmed_at: now,
      confirmation_token_hash: null,
      confirmation_expires_at: null
    }).eq("subscriber_id", subscriber.subscriber_id)
      .eq("confirmation_token_hash", tokenHash)
      .select("subscriber_id")
      .maybeSingle();
    if (updateError) throw updateError;
    if (!updated) return fail(origin, 409, "This confirmation link was already used.");
    const { error: referralError } = await admin.from("newsletter_referrals").update({
      status: "confirmed",
      confirmed_at: now
    }).eq("referred_subscriber_id", subscriber.subscriber_id).eq("status", "pending");
    if (referralError) throw referralError;
    await audit(admin, "newsletter.subscription_confirmed", "newsletter_subscriber", subscriber.subscriber_id);
  }
  const preferencesToken = await createSignedToken({
    subscriberId: subscriber.subscriber_id,
    scope: "preferences",
    expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000
  }, TOKEN_SECRET);
  return json(origin, {
    confirmed: true,
    referral_code: subscriber.referral_code,
    preferences_token: preferencesToken,
    masked_email: maskedEmail(subscriber.email)
  });
}

async function newsletterUnsubscribe(request, origin, admin) {
  if (request.method !== "POST") return fail(origin, 405, "Method not allowed.");
  assertConfigured(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "WLC_TOKEN_SIGNING_SECRET"]);
  const body = await requestBody(request);
  const claims = await verifySignedToken(body.token, TOKEN_SECRET, "unsubscribe");
  const { data: subscriber, error: readError } = await admin
    .from("newsletter_subscribers")
    .select("subscriber_id,email,status")
    .eq("subscriber_id", claims.sub)
    .maybeSingle();
  if (readError) throw readError;
  if (!subscriber) return fail(origin, 400, "This unsubscribe link is invalid.");
  const now = new Date().toISOString();
  const { error: updateError } = await admin.from("newsletter_subscribers").update({
    status: "unsubscribed",
    unsubscribed_at: now
  }).eq("subscriber_id", subscriber.subscriber_id);
  if (updateError) throw updateError;
  const { error: suppressionError } = await admin.from("newsletter_suppressions").upsert({
    email_hash: await sha256(subscriber.email),
    reason: "unsubscribe"
  }, { onConflict: "email_hash" });
  if (suppressionError) throw suppressionError;
  await audit(admin, "newsletter.unsubscribed", "newsletter_subscriber", subscriber.subscriber_id);
  return json(origin, { unsubscribed: true });
}

async function newsletterPreferences(request, origin, admin) {
  if (!new Set(["GET", "PUT"]).has(request.method)) return fail(origin, 405, "Method not allowed.");
  assertConfigured(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "WLC_TOKEN_SIGNING_SECRET"]);
  const body = request.method === "PUT" ? await requestBody(request) : {};
  const token = body.token || new URL(request.url).searchParams.get("token") || "";
  const claims = await verifySignedToken(token, TOKEN_SECRET, "preferences");
  if (request.method === "PUT") {
    const preferences = cleanPreferences(body.preferences);
    const { error } = await admin.from("newsletter_subscribers").update({ preferences })
      .eq("subscriber_id", claims.sub).eq("status", "active");
    if (error) throw error;
    const { error: communicationError } = await admin.from("communication_preferences").upsert({
      subscriber_id: claims.sub,
      daily_group_chat: preferences.daily_group_chat,
      product_updates: preferences.product_updates,
      open_tracking: preferences.open_tracking
    }, { onConflict: "subscriber_id" });
    if (communicationError) throw communicationError;
    await audit(admin, "newsletter.preferences_updated", "newsletter_subscriber", claims.sub);
  }
  const { data, error } = await admin.from("newsletter_subscribers")
    .select("email,status,preferences,referral_code")
    .eq("subscriber_id", claims.sub)
    .maybeSingle();
  if (error) throw error;
  if (!data) return fail(origin, 404, "Subscriber not found.");
  return json(origin, {
    status: data.status,
    masked_email: maskedEmail(data.email),
    preferences: cleanPreferences(data.preferences),
    referral_code: data.referral_code
  });
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin") || "";
  if (request.method === "OPTIONS") {
    if (!allowedOrigin(origin)) return fail(origin, 403, "Origin not allowed.");
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  try {
    const route = routeOf(request.url);
    if (route === "health" && request.method === "GET") return json(origin, { ok: true, service: "wlc-audience-api" });
    assertConfigured(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    if (route === "newsletter/signup") return await newsletterSignup(request, origin, admin);
    if (route === "newsletter/confirm") return await newsletterConfirm(request, origin, admin);
    if (route === "newsletter/unsubscribe") return await newsletterUnsubscribe(request, origin, admin);
    if (route === "newsletter/preferences") return await newsletterPreferences(request, origin, admin);
    return fail(origin, 404, "Not found.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed.";
    console.error("Audience API request failed", { route: routeOf(request.url), message });
    const status = /valid|invalid|expired|required|too large|JSON/i.test(message) ? 400 : 500;
    return fail(origin, status, status === 500 ? "The room could not process that request." : message);
  }
});
