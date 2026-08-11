import { execFileSync } from "node:child_process";

const eventName = process.env.GITHUB_EVENT_NAME || "";
if (eventName !== "pull_request") {
  console.log("Newsroom structure approval check is only required for pull requests.");
  process.exit(0);
}

const base = process.env.WLC_BASE_SHA;
const head = process.env.WLC_HEAD_SHA || "HEAD";
const labels = new Set(JSON.parse(process.env.WLC_PR_LABELS || "[]"));
const approvalLabel = "owner-approved-structure";

if (!base) throw new Error("WLC_BASE_SHA is required for pull-request structure checks.");

const changed = execFileSync("git", ["diff", "--name-only", `${base}...${head}`], { encoding: "utf8" })
  .split(/\r?\n/)
  .map((path) => path.trim())
  .filter(Boolean);

const exact = new Set([
  "index.html",
  "custom-submission.js",
  "newsroom-contract.js",
  "newsroom-site.js",
  "newsroom-taxonomy.js",
  "rolling-archive.js",
  "social-card-export.js",
  "social-tools.js",
  "scripts/build-site.mjs",
  "scripts/lib/validation.mjs",
  "docs/NEWSROOM_RULES.md"
]);
const prefixes = ["editor/", ".github/workflows/"];
const protectedChanges = changed.filter((path) => exact.has(path) || prefixes.some((prefix) => path.startsWith(prefix)));

if (!protectedChanges.length) {
  console.log("No protected newsroom structure changed.");
  process.exit(0);
}
if (!labels.has(approvalLabel)) {
  throw new Error(`Protected newsroom structure changed without ${approvalLabel}:\n- ${protectedChanges.join("\n- ")}`);
}
console.log(`Owner approval confirmed for ${protectedChanges.length} protected newsroom file(s).`);
