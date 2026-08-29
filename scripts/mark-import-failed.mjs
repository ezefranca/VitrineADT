import { readFile } from "node:fs/promises";
import { githubRequest, repositoryFromEnvironment, replaceStateLabels, upsertIssueComment } from "./github.mjs";

const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, "utf8"));
const issueNumber = event.issue?.number;
const repository = repositoryFromEnvironment();
const issue = await githubRequest(`/repos/${repository}/issues/${issueNumber}`);

await replaceStateLabels({
  repository,
  issueNumber,
  currentLabels: issue.labels ?? [],
  add: ["status/awaiting-moderation"],
  prefixes: ["status/", "publication/", "moderation/"],
  removeExact: []
});

await upsertIssueComment({
  repository,
  issueNumber,
  marker: "<!-- vitrineadt-publication-status -->",
  body: "<!-- vitrineadt-publication-status -->\n## Não foi possível preparar a publicação\n\nA aprovação foi devolvida para moderação porque a entrada ou o ícone não pôde ser materializado com segurança. Um moderador pode corrigir a Issue e adicionar `moderation/approved` novamente."
});
