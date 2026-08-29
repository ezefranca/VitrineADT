import { readFile } from "node:fs/promises";
import path from "node:path";
import { githubRequest, repositoryFromEnvironment, upsertIssueComment } from "./github.mjs";

const catalogPath = path.resolve(process.cwd(), process.argv[2] ?? "dist/data/apps.json");
const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
const repository = repositoryFromEnvironment();
const releaseTag = process.env.RELEASE_TAG ?? "release atual";
const siteURL = process.env.SITE_URL ?? "";
const issueNumbers = [...new Set(catalog.apps.map((app) => app.submission?.issue).filter(Number.isInteger))];

for (const issueNumber of issueNumbers) {
  const issue = await githubRequest(`/repos/${repository}/issues/${issueNumber}`);
  const labels = (issue.labels ?? []).map((label) => typeof label === "string" ? label : label.name).filter(Boolean);
  if (!labels.includes("publication/queued")) continue;

  const nextLabels = [...new Set(labels.filter((label) => !label.startsWith("publication/") && !label.startsWith("status/")).concat("publication/published"))];
  await githubRequest(`/repos/${repository}/issues/${issueNumber}`, {
    method: "PATCH",
    body: { labels: nextLabels, state: "closed", state_reason: "completed" }
  });
  await upsertIssueComment({
    repository,
    issueNumber,
    marker: "<!-- vitrineadt-publication-status -->",
    body: `<!-- vitrineadt-publication-status -->\n## Publicado\n\nEste aplicativo foi publicado na release **${releaseTag}**.${siteURL ? `\n\n[Ver na galeria](${siteURL})` : ""}\n\nA Issue continuará disponível para receber reações 👍.`
  });
}

console.log(`Estado de publicação verificado para ${issueNumbers.length} Issue(s).`);
