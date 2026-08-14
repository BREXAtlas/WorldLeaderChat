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
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`GitHub API ${options.method || "GET"} ${path} failed (${response.status}): ${payload?.message || text}`);
  return payload;
}

const issues = await github(`/repos/${repository}/issues?state=open&labels=news-candidate&per_page=100`);
let recovered = 0;
for (const issue of issues.filter((candidate) => !candidate.pull_request)) {
  const labels = new Set((issue.labels || []).map((label) => typeof label === "string" ? label : label.name));
  if (!labels.has("drafting")) continue;
  labels.delete("drafting");
  labels.add("needs-editor");
  await github(`/repos/${repository}/issues/${issue.number}`, {
    method: "PATCH",
    body: { labels: [...labels] }
  });
  recovered += 1;
  console.log(`Recovered interrupted issue #${issue.number} from Drafting to Needs Editor.`);
}

console.log(`Interrupted drafting recovery complete: ${recovered} file(s) reset.`);
