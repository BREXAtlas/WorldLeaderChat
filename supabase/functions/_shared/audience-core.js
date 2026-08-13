const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const ALLOWED_ORIGINS = Object.freeze([
  "https://worldleaders.chat",
  "https://www.worldleaders.chat",
  "http://127.0.0.1:8000",
  "http://localhost:8000"
]);

export function normalizeEmail(value) {
  const email = String(value || "").normalize("NFKC").trim().toLowerCase();
  if (email.length < 3 || email.length > 320) throw new Error("Enter a valid email address.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
  if (/[\r\n\0]/.test(email)) throw new Error("Enter a valid email address.");
  return email;
}

export function cleanSource(value) {
  const source = String(value || "website").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").slice(0, 80);
  return source || "website";
}

export function cleanReferralCode(value) {
  const code = String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 24);
  return code.length >= 8 ? code : "";
}

export function cleanPreferences(value) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    daily_group_chat: input.daily_group_chat !== false,
    product_updates: input.product_updates === true,
    open_tracking: input.open_tracking === true
  };
}

export function allowedOrigin(origin, allowMissing = false) {
  if (!origin) return allowMissing;
  return ALLOWED_ORIGINS.includes(origin);
}

export function corsHeaders(origin) {
  const allowed = allowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function base64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function unbase64url(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(String(value)));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmac(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return base64url(new Uint8Array(signature));
}

export async function createSignedToken({ subscriberId, scope, expiresAt, nonce = crypto.randomUUID() }, secret) {
  if (!/^[0-9a-f-]{36}$/i.test(String(subscriberId))) throw new Error("A valid subscriber ID is required.");
  if (!new Set(["confirm", "preferences", "unsubscribe", "delete"]).has(scope)) throw new Error("Invalid token scope.");
  if (String(secret || "").length < 32) throw new Error("Token signing secret must contain at least 32 characters.");
  const payload = base64url(encoder.encode(JSON.stringify({ sub: subscriberId, scope, exp: Number(expiresAt), nonce })));
  return `v1.${payload}.${await hmac(`v1.${payload}`, secret)}`;
}

export async function verifySignedToken(token, secret, expectedScope, now = Date.now()) {
  const [version, payload, suppliedSignature, extra] = String(token || "").split(".");
  if (version !== "v1" || !payload || !suppliedSignature || extra) throw new Error("This link is invalid.");
  const expectedSignature = await hmac(`${version}.${payload}`, secret);
  const supplied = encoder.encode(suppliedSignature);
  const expected = encoder.encode(expectedSignature);
  if (supplied.length !== expected.length) throw new Error("This link is invalid.");
  let mismatch = 0;
  for (let index = 0; index < supplied.length; index += 1) mismatch |= supplied[index] ^ expected[index];
  if (mismatch !== 0) throw new Error("This link is invalid.");
  let decoded;
  try {
    decoded = JSON.parse(decoder.decode(unbase64url(payload)));
  } catch {
    throw new Error("This link is invalid.");
  }
  if (decoded.scope !== expectedScope) throw new Error("This link cannot be used for that action.");
  if (!/^[0-9a-f-]{36}$/i.test(String(decoded.sub || ""))) throw new Error("This link is invalid.");
  if (!Number.isFinite(decoded.exp) || decoded.exp <= now) throw new Error("This link has expired.");
  if (!decoded.nonce || String(decoded.nonce).length > 100) throw new Error("This link is invalid.");
  return decoded;
}

export function maskedEmail(email) {
  const [local, domain] = normalizeEmail(email).split("@");
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"•".repeat(Math.max(2, Math.min(8, local.length - visible.length)))}@${domain}`;
}

export function confirmationMessage({ confirmUrl }) {
  const safeUrl = String(confirmUrl).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  return {
    subject: "Confirm your place in THE DAILY GROUP CHAT",
    text: `THE DAILY GROUP CHAT\n\nThe day’s real stories. The conversations everyone assumes happened afterward.\n\nConfirm your subscription:\n${confirmUrl}\n\nIf you did not request this, ignore this email.`,
    html: `<!doctype html><html lang="en"><body style="margin:0;background:#f7f2e8;color:#111;font-family:Arial,Helvetica,sans-serif"><div style="max-width:620px;margin:auto;padding:32px 20px"><div style="border-top:8px solid #b40000;border-bottom:2px solid #111;padding:18px 0"><div style="font:900 13px Arial;letter-spacing:.12em;color:#b40000">WORLD LEADERS CHAT</div><h1 style="font:900 38px/1 Georgia,serif;margin:8px 0">THE DAILY GROUP CHAT</h1></div><p style="font:18px/1.5 Georgia,serif">The day’s real stories. The conversations everyone assumes happened afterward.</p><p style="margin:28px 0"><a href="${safeUrl}" style="display:inline-block;background:#b40000;color:#fff;padding:14px 18px;text-decoration:none;font-weight:900">CONFIRM &amp; JOIN THE CHAT →</a></p><p style="font-size:13px;line-height:1.5;color:#555">If you did not request this, ignore this email. You will not be subscribed.</p><p style="border-top:1px solid #999;padding-top:14px;font-size:12px"><a href="https://worldleaders.chat/" style="color:#b40000">WorldLeaders.chat</a></p></div></body></html>`
  };
}

export function hasBotField(body) {
  return Boolean(String(body?.company || body?.website_confirm || "").trim());
}

export function publicSubscriberResponse(extra = {}) {
  return {
    accepted: true,
    message: "Check your inbox to confirm your place in THE DAILY GROUP CHAT.",
    ...extra
  };
}
