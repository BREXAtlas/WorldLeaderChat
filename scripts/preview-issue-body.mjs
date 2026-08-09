import { resolve } from "node:path";
import { createEditorialIssueBody } from "./lib/editorial.mjs";
import { readJson } from "./lib/io.mjs";

const input = resolve(process.cwd(), process.argv[2] || process.env.INGESTION_OUTPUT || "tmp/ingestion-candidates.json");
const report = await readJson(input);
const candidate = report.candidates?.[0];
if (!candidate) throw new Error(`No candidate found in ${input}.`);
console.log(createEditorialIssueBody(candidate, "https://github.com/BREXAtlas/WorldLeaderChat"));
