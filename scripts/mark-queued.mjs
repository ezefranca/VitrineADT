import { readFile } from "node:fs/promises";
import { repositoryFromEnvironment, replaceStateLabels, upsertIssueComment } from "./github.mjs";

const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, "utf8"));
const issue = event.issue;
const repository = repositoryFromEnvironment();

await replaceStateLabels({
  repository,
  issueNumber: issue.number,
  currentLabels: issue.labels ?? [],
  add: ["publication/queued", "moderation/approved"],
  prefixes: ["status/", "publication/"],
  removeExact: []
});

await upsertIssueComment({
  repository,
  issueNumber: issue.number,
  marker: "<!-- vitrineadt-publication-status -->",
  body: "<!-- vitrineadt-publication-status -->\n## Aprovado para publicação\n\nO aplicativo foi adicionado ao catálogo e entrará no site na próxima release publicada por um moderador. Esta Issue permanecerá disponível para receber reações 👍."
});
