import { appendFile, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { githubRequest, replaceStateLabels, repositoryFromEnvironment, upsertIssueComment } from "./github.mjs";
import { isOriginalSubmitter, parseRemovalTarget } from "./removal.mjs";

const ROOT = process.cwd();
const APPS_DIRECTORY = path.join(ROOT, "data", "apps");
const ICONS_DIRECTORY = path.join(ROOT, "public", "icons");
const MODERATOR_PERMISSIONS = new Set(["admin", "maintain", "write", "triage"]);

async function records() {
  const names = (await readdir(APPS_DIRECTORY)).filter((name) => name.endsWith(".json"));
  return Promise.all(names.map(async (name) => ({
    path: path.join(APPS_DIRECTORY, name),
    record: JSON.parse(await readFile(path.join(APPS_DIRECTORY, name), "utf8"))
  })));
}

async function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

async function setRemovalState({ repository, issue, add, state }) {
  await replaceStateLabels({
    repository,
    issueNumber: issue.number,
    currentLabels: issue.labels,
    add,
    prefixes: ["removal/"]
  });
  if (state) await githubRequest(`/repos/${repository}/issues/${issue.number}`, { method: "PATCH", body: { state } });
}

async function comment(repository, issueNumber, body) {
  await upsertIssueComment({ repository, issueNumber, marker: "<!-- vitrineadt-removal-status -->", body: `<!-- vitrineadt-removal-status -->\n${body}` });
}

async function main() {
  if (!process.env.GITHUB_EVENT_PATH) throw new Error("GITHUB_EVENT_PATH não está definido.");
  const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, "utf8"));
  const requestIssue = event.issue;
  const requester = requestIssue?.user?.login;
  const repository = repositoryFromEnvironment();
  if (!requestIssue?.number || !requester) throw new Error("Pedido de remoção inválido.");

  const submissionIssue = parseRemovalTarget(requestIssue.body ?? "");
  if (!submissionIssue) {
    await setRemovalState({ repository, issue: requestIssue, add: ["removal/failed"] });
    await comment(repository, requestIssue.number, "## Não foi possível identificar a entrada\n\nInforme no campo **Issue da entrada** o endereço completo da Issue usada para curtir o aplicativo.");
    await setOutput("removed", "false");
    return;
  }

  const catalog = await records();
  const target = catalog.find(({ record }) => record.submission?.issue === submissionIssue);
  if (!target) {
    await setRemovalState({ repository, issue: requestIssue, add: ["removal/failed"] });
    await comment(repository, requestIssue.number, `## Entrada não encontrada\n\nNenhum aplicativo publicado está associado à Issue #${submissionIssue}.`);
    await setOutput("removed", "false");
    return;
  }

  let authorized = event.action === "opened" && isOriginalSubmitter(target.record, requester);
  let approvedBy = requester;
  if (event.action === "labeled" && event.label?.name === "removal/approved") {
    approvedBy = event.sender?.login ?? "unknown";
    const permission = await githubRequest(`/repos/${repository}/collaborators/${encodeURIComponent(approvedBy)}/permission`);
    authorized = MODERATOR_PERMISSIONS.has(permission.permission);
    if (!authorized) throw new Error(`@${approvedBy} não possui permissão para aprovar remoções.`);
  }

  if (!authorized) {
    await setRemovalState({ repository, issue: requestIssue, add: ["removal/awaiting-moderation"] });
    await comment(repository, requestIssue.number, `## Aguardando moderação\n\nA conta @${requester} não é a conta registrada na submissão original. Um moderador verificará o vínculo e, se aprovar, adicionará a etiqueta \`removal/approved\`. Não publique documentos ou dados privados nesta Issue.`);
    await setOutput("removed", "false");
    return;
  }

  await rm(target.path);
  const iconName = target.record.icon?.path ? path.basename(target.record.icon.path) : null;
  const iconIsShared = iconName && catalog.some(({ record }) => record !== target.record && path.basename(record.icon?.path ?? "") === iconName);
  if (iconName && !iconIsShared) await rm(path.join(ICONS_DIRECTORY, iconName), { force: true });

  await setRemovalState({ repository, issue: requestIssue, add: ["removal/completed"], state: "closed" });
  await comment(repository, requestIssue.number, `## Remoção aceita\n\n**${target.record.name}** foi retirado do catálogo por ${event.action === "opened" ? "confirmação da conta que fez a submissão original" : `aprovação de @${approvedBy}`}. A alteração aparecerá no site na próxima publicação.`);
  await upsertIssueComment({
    repository,
    issueNumber: submissionIssue,
    marker: "<!-- vitrineadt-entry-removed -->",
    body: `<!-- vitrineadt-entry-removed -->\nEsta entrada foi removida do catálogo pelo pedido #${requestIssue.number}. A Issue original permanece como registro público e não será apagada.`
  });
  await setOutput("removed", "true");
  await setOutput("app_name", target.record.name.replaceAll("\n", " "));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
