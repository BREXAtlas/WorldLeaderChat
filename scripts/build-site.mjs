import { execFileSync } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { readJson } from "./lib/io.mjs";

const root = process.cwd();
const output = resolve(root, "_site");
execFileSync(process.execPath, [resolve(root, "scripts/validate-repository.mjs")], { stdio: "inherit" });

await rm(output, { recursive: true, force: true });
await mkdir(resolve(output, "data"), { recursive: true });
await mkdir(resolve(output, "editor"), { recursive: true });
await cp(resolve(root, "index.html"), resolve(output, "index.html"));
await cp(resolve(root, "index.html"), resolve(output, "404.html"));
await cp(resolve(root, "editor/index.html"), resolve(output, "editor/index.html"));
await cp(resolve(root, "editor/app.js"), resolve(output, "editor/app.js"));
await cp(resolve(root, "data/published-events.json"), resolve(output, "data/published-events.json"));

const published = await readJson(resolve(root, "data/published-events.json"), []);
const siteMeta = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  publishedEventCount: published.length,
  latestEventDate: published[0]?.eventDate ?? null
};
await writeFile(resolve(output, "data/site-meta.json"), `${JSON.stringify(siteMeta, null, 2)}\n`, "utf8");
await writeFile(resolve(output, ".nojekyll"), "", "utf8");
await writeFile(resolve(output, "robots.txt"), "User-agent: *\nAllow: /\nDisallow: /editor/\n", "utf8");

const htmlSize = (await readFile(resolve(output, "index.html"))).byteLength;
const editorSize = (await readFile(resolve(output, "editor/index.html"))).byteLength;
const appSize = (await readFile(resolve(output, "editor/app.js"))).byteLength;
console.log(`Built GitHub Pages artifact in _site (${htmlSize} byte index, ${editorSize} byte editor, ${appSize} byte editor app, ${published.length} external event(s)).`);
