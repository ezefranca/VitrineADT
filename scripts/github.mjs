const API_ROOT = "https://api.github.com";

export function repositoryFromEnvironment() {
  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository || !repository.includes("/")) throw new Error("Defina GITHUB_REPOSITORY como owner/repository.");
  return repository;
}

export async function githubRequest(path, { method = "GET", body, token = process.env.GITHUB_TOKEN } = {}) {
  if (!token) throw new Error("GITHUB_TOKEN não está definido.");
  const response = await fetch(`${API_ROOT}${path}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "VitrineADTGallery/0.1"
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API ${method} ${path}: ${response.status} ${text.slice(0, 500)}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

export async function upsertIssueComment({ repository, issueNumber, marker, body }) {
  const comments = await githubRequest(`/repos/${repository}/issues/${issueNumber}/comments?per_page=100`);
  const existing = comments.find((comment) => String(comment.body ?? "").includes(marker));
  if (existing) return githubRequest(`/repos/${repository}/issues/comments/${existing.id}`, { method: "PATCH", body: { body } });
  return githubRequest(`/repos/${repository}/issues/${issueNumber}/comments`, { method: "POST", body: { body } });
}

export async function replaceStateLabels({ repository, issueNumber, currentLabels, add, prefixes, removeExact = [] }) {
  const retained = currentLabels
    .map((label) => typeof label === "string" ? label : label.name)
    .filter(Boolean)
    .filter((label) => !prefixes.some((prefix) => label.startsWith(prefix)))
    .filter((label) => !removeExact.includes(label));
  const labels = [...new Set([...retained, ...add])];
  return githubRequest(`/repos/${repository}/issues/${issueNumber}`, { method: "PATCH", body: { labels } });
}
