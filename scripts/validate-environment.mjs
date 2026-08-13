import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const production = process.argv.includes("--production");
const example = await readFile(resolve(process.cwd(), ".env.example"), "utf8");
const declared = new Set([...example.matchAll(/^([A-Z][A-Z0-9_]+)=/gm)].map((match) => match[1]));
const errors = [];

const publicNames = ["WLC_SITE_URL", "WLC_SUPABASE_URL", "WLC_SUPABASE_PUBLISHABLE_KEY"];
const serverNames = [
  "WLC_TOKEN_SIGNING_SECRET",
  "WLC_RATE_LIMIT_SECRET",
  "RESEND_API_KEY",
  "NEWSLETTER_FROM_EMAIL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_SUPPORTER_MONTHLY",
  "STRIPE_PRICE_SUPPORTER_ANNUAL",
  "WLC_GITHUB_TOKEN",
  "WLC_GITHUB_REPOSITORY"
];

for (const name of [...publicNames, ...serverNames]) {
  if (!declared.has(name)) errors.push(`.env.example is missing ${name}.`);
}

const browserFiles = [
  "index.html",
  "newsroom-site.js",
  "newsroom-experience.js",
  "social-tools.js",
  "social-card-export.js",
  "editor/index.html",
  "editor/app.js"
];
const secretPattern = new RegExp(serverNames.join("|"), "g");
for (const file of browserFiles) {
  const source = await readFile(resolve(process.cwd(), file), "utf8");
  if (secretPattern.test(source)) errors.push(`${file} references a server-only secret name.`);
  secretPattern.lastIndex = 0;
  if (/(?:sk_live_|sk_test_|whsec_|re_[A-Za-z0-9]{16,}|service_role)/.test(source)) {
    errors.push(`${file} appears to contain a provider credential.`);
  }
}

if (production) {
  const required = [...publicNames, ...serverNames];
  for (const name of required) {
    const value = String(process.env[name] || "").trim();
    if (!value || /replace_me|project_ref/i.test(value)) errors.push(`Production environment variable ${name} is missing.`);
  }
  for (const name of ["WLC_TOKEN_SIGNING_SECRET", "WLC_RATE_LIMIT_SECRET"]) {
    if (String(process.env[name] || "").length < 32) errors.push(`${name} must contain at least 32 characters.`);
  }
  if (process.env.WLC_SITE_URL !== "https://worldleaders.chat") errors.push("WLC_SITE_URL must be https://worldleaders.chat in production.");
}

if (errors.length) {
  console.error("Environment validation failed:\n- " + errors.join("\n- "));
  process.exitCode = 1;
} else {
  console.log(`Environment contract passed${production ? " for production" : ""} (${publicNames.length} public, ${serverNames.length} server-only variables).`);
}
