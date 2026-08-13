import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const sql = await readFile(resolve(process.cwd(), "supabase/tests/audience_foundation.sql"), "utf8");
const result = spawnSync("docker", [
  "exec", "-i", "supabase_db_world-leaders-chat",
  "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"
], {
  input: sql,
  encoding: "utf8",
  stdio: ["pipe", "pipe", "pipe"]
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
console.log("Database integration tests passed (RLS roles, staff authorization, entitlement immutability, duplicate delivery protection).");
