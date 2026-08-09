import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (fallback !== undefined && error?.code === "ENOENT") return fallback;
    throw new Error(`Could not read JSON from ${path}: ${error.message}`, { cause: error });
  }
}

export async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

export function slugify(value, maxLength = 80) {
  const slug = String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
  return slug || "world-event";
}

export function normalizeUrl(value) {
  try {
    const url = new URL(String(value).trim());
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|mc_cid|mc_eid)/i.test(key)) url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    return String(value ?? "").trim();
  }
}

export function cleanWhitespace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function appendGitHubOutput(key, value) {
  const output = process.env.GITHUB_OUTPUT;
  if (!output) return;
  return import("node:fs").then(({ appendFileSync }) => {
    appendFileSync(output, `${key}=${String(value).replace(/\r?\n/g, " ")}\n`, "utf8");
  });
}
