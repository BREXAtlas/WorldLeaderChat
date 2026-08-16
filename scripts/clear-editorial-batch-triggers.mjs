const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const apiBase = process.env.GITHUB_API_URL || "https://api.github.com";

if (!token) throw new Error("GITHUB_TOKEN is required.");
if (!repository || !repository.includes("/")) throw new Error("GITHUB_REPOSITORY must be owner/name.");

async function github(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    method: options.method || "GET",
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-github-api-version": "2022-11-28"
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  if (response.status === 204) return null;
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`GitHub API ${options.method || "GET"} ${path} failed (${response.status}): ${payload?.message || text}`);
  return payload;
}

const triggers = await github(`/repos/${repository}/issues?state=open&labels=draft-batch-requested&per_page=100`);
for (const issue of triggers.filter((candidate) => !candidate.pull_request)) {
  const labels = (issue.labels || []).map((label) => typeof label === "string" ? label : label.name)
    .filter((label) => label !== "draft-batch-requested");
  await github(`/repos/${repository}/issues/${issue.number}`, { method: "PATCH", body: { labels } });
  console.log(`Cleared completed batch trigger from issue #${issue.number}.`);
}
console.log(`Batch trigger cleanup complete: ${triggers.length} marker(s) cleared.`);
