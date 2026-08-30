import { createHash } from "node:crypto";
import { appendFile, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { githubRequest, replaceStateLabels, repositoryFromEnvironment, upsertIssueComment } from "./github.mjs";
import { isOriginalSubmitter, parseRemovalTarget } from "./removal.mjs";
import { downloadIcon } from "./images.mjs";

const ROOT = process.cwd();
const APPS_DIRECTORY = path.join(ROOT, "data", "apps");
const ICONS_DIRECTORY = path.join(ROOT, "public", "icons");
const MODERATOR_PERMISSIONS = new Set(["admin", "maintain", "write", "triage"]);

const FIELD_LABELS = {
  appName: "Nome do aplicativo",
  developerName: "Desenvolvedor ou equipe",
  developerURL: "Site do desenvolvedor",
  description: "Descrição curta",
  platforms: "Plataformas",
  websiteURL: "Link principal do aplicativo",
  appStoreURL: "Link da App Store",
  googlePlayURL: "Link do Google Play",
  sourceURL: "Código-fonte",
  iconURL: "Link direto para o ícone",
  declarations: "Declaração"
};

const PLATFORM_MAP = new Map([
  ["web", "web"],
  ["ios", "ios"],
  ["ipados", "ipados"],
  ["macos", "macos"],
  ["android", "android"],
  ["windows", "windows"],
  ["linux", "linux"],
  ["watchos", "watchos"],
  ["tvos", "tvos"],
  ["outra", "other"]
]);

function cleanField(value = "") {
  const trimmed = String(value).trim();
  return trimmed === "_No response_" ? "" : trimmed;
}

function sectionsFromBody(body) {
  if (typeof body !== "string" || body.length > 50_000) throw new Error("O corpo da Issue é inválido ou excede 50 KB.");
  const sections = new Map();
  const matches = [...body.matchAll(/^###\s+(.+)$/gm)];
  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    const next = matches[index + 1];
    const valueStart = current.index + current[0].length;
    const valueEnd = next ? next.index : body.length;
    sections.set(current[1].trim(), cleanField(body.slice(valueStart, valueEnd)));
  }
  return sections;
}

export function parseMetadataUpdate(body) {
  const sections = sectionsFromBody(body);
  const value = (key) => sections.get(FIELD_LABELS[key]) ?? "";
  const platforms = value("platforms")
    .split("\n")
    .filter((line) => /^- \[[xX]\]\s+/.test(line.trim()))
    .map((line) => line.replace(/^- \[[xX]\]\s+/, "").trim().toLocaleLowerCase("pt-BR"))
    .map((label) => PLATFORM_MAP.get(label))
    .filter(Boolean);
  const updates = {
    name: value("appName"),
    developerName: value("developerName"),
    developerURL: value("developerURL"),
    description: value("description"),
    platforms: [...new Set(platforms)],
    websiteURL: value("websiteURL"),
    appStoreURL: value("appStoreURL"),
    googlePlayURL: value("googlePlayURL"),
    sourceURL: value("sourceURL"),
    iconURL: value("iconURL")
  };
  return {
    entryIssue: parseRemovalTarget(body),
    updates,
    declarationCount: value("declarations").split("\n").filter((line) => /^- \[[xX]\]\s+/.test(line.trim())).length,
    hasUpdates: Object.entries(updates).some(([key, item]) => key === "platforms" ? item.length > 0 : Boolean(item))
  };
}

function isHTTPSURL(value, expectedHostSuffix) {
  if (!value) return true;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    return !expectedHostSuffix || url.hostname === expectedHostSuffix || url.hostname.endsWith(`.${expectedHostSuffix}`);
  } catch {
    return false;
  }
}

export function validateMetadataUpdate(request) {
  const errors = [];
  if (!Number.isInteger(request.entryIssue) || request.entryIssue < 1) errors.push("Informe o endereço da Issue da entrada.");
  if (!request.hasUpdates) errors.push("Informe pelo menos um metadado para atualizar.");
  if (request.declarationCount < 1) errors.push("A declaração obrigatória precisa estar marcada.");
  const { updates } = request;
  if (updates.name.length > 100) errors.push("O nome do aplicativo pode ter até 100 caracteres.");
  if (updates.developerName.length > 120) errors.push("O nome do desenvolvedor pode ter até 120 caracteres.");
  if (updates.description.length > 400) errors.push("A descrição pode ter até 400 caracteres.");
  for (const [url, label] of [[updates.developerURL, "site do desenvolvedor"], [updates.websiteURL, "link principal"], [updates.sourceURL, "código-fonte"], [updates.iconURL, "ícone"]]) {
    if (url && !isHTTPSURL(url)) errors.push(`O ${label} precisa ser uma URL HTTPS válida.`);
  }
  if (updates.appStoreURL && !isHTTPSURL(updates.appStoreURL, "apps.apple.com")) errors.push("O link da App Store precisa apontar para apps.apple.com.");
  if (updates.googlePlayURL && !isHTTPSURL(updates.googlePlayURL, "play.google.com")) errors.push("O link do Google Play precisa apontar para play.google.com.");
  return errors;
}

async function readRecords() {
  const files = (await readdir(APPS_DIRECTORY)).filter((name) => name.endsWith(".json"));
  return Promise.all(files.map(async (name) => ({ path: path.join(APPS_DIRECTORY, name), record: JSON.parse(await readFile(path.join(APPS_DIRECTORY, name), "utf8")) })));
}

async function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

async function setMetadataState(repository, issue, add) {
  await replaceStateLabels({ repository, issueNumber: issue.number, currentLabels: issue.labels ?? [], add, prefixes: ["metadata/"] });
}

async function comment(repository, issueNumber, body) {
  await upsertIssueComment({ repository, issueNumber, marker: "<!-- vitrineadt-metadata-status -->", body: `<!-- vitrineadt-metadata-status -->\n${body}` });
}

async function applyUpdates(target, updates) {
  const record = target.record;
  if (updates.name) record.name = updates.name;
  if (updates.developerName) record.developer = { ...(record.developer ?? {}), name: updates.developerName };
  if (updates.developerURL) record.developer = { ...(record.developer ?? {}), url: updates.developerURL };
  if (updates.description) record.description = updates.description;
  if (updates.platforms.length > 0) record.platforms = updates.platforms;
  record.links = { ...(record.links ?? {}) };
  if (updates.websiteURL) record.links.website = updates.websiteURL;
  if (updates.appStoreURL) record.links.appStore = updates.appStoreURL;
  if (updates.googlePlayURL) record.links.googlePlay = updates.googlePlayURL;
  if (updates.sourceURL) record.links.source = updates.sourceURL;
  if (updates.iconURL) {
    const icon = await downloadIcon(updates.iconURL);
    const fileName = `${record.id}.${icon.extension}`;
    await writeFile(path.join(ICONS_DIRECTORY, fileName), icon.bytes);
    record.icon = {
      path: `/icons/${fileName}`,
      sourceURL: icon.finalURL,
      sha256: createHash("sha256").update(icon.bytes).digest("hex")
    };
  }
  record.updatedAt = new Date().toISOString();
  await writeFile(target.path, `${JSON.stringify(record, null, 2)}\n`);
}

async function main() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) throw new Error("GITHUB_EVENT_PATH não está definido.");
  const event = JSON.parse(await readFile(eventPath, "utf8"));
  const issue = event.issue;
  const requester = issue?.user?.login;
  const repository = repositoryFromEnvironment();
  if (!issue?.number || !requester) throw new Error("Issue de atualização inválida.");

  const request = parseMetadataUpdate(issue.body ?? "");
  const validationErrors = validateMetadataUpdate(request);
  const catalog = await readRecords();
  const target = catalog.find(({ record }) => record.submission?.issue === request.entryIssue);
  if (!target) validationErrors.push("Nenhuma entrada publicada está associada à Issue informada.");
  if (validationErrors.length > 0) {
    await setMetadataState(repository, issue, ["metadata/failed"]);
    await comment(repository, issue.number, `## Não foi possível atualizar os dados\n\n${validationErrors.map((error) => `- ${error}`).join("\n")}`);
    await setOutput("applied", "false");
    return;
  }

  const isModeratorApproval = event.action === "labeled" && event.label?.name === "metadata/approved";
  let authorized = event.action === "opened" && isOriginalSubmitter(target.record, requester);
  let approvedBy = requester;
  if (isModeratorApproval) {
    approvedBy = event.sender?.login ?? "unknown";
    const permission = await githubRequest(`/repos/${repository}/collaborators/${encodeURIComponent(approvedBy)}/permission`);
    authorized = MODERATOR_PERMISSIONS.has(permission.permission);
    if (!authorized) throw new Error(`@${approvedBy} não possui permissão para aprovar atualizações.`);
  }

  if (!authorized) {
    await setMetadataState(repository, issue, ["metadata/awaiting-moderation"]);
    await comment(repository, issue.number, `## Aguardando moderação\n\nA conta @${requester} não é a conta registrada na submissão original. Um moderador deve verificar as alterações e adicionar a etiqueta \`metadata/approved\`. Não publique documentos ou dados privados nesta Issue.`);
    await setOutput("applied", "false");
    return;
  }

  try {
    await applyUpdates(target, request.updates);
  } catch (error) {
    await setMetadataState(repository, issue, ["metadata/failed"]);
    await comment(repository, issue.number, `## Não foi possível aplicar a atualização\n\n${error.message}\n\nCorrija os dados na Issue e abra uma nova solicitação.`);
    await setOutput("applied", "false");
    return;
  }
  await setMetadataState(repository, issue, ["metadata/applied"]);
  await githubRequest(`/repos/${repository}/issues/${issue.number}`, { method: "PATCH", body: { state: "closed", state_reason: "completed" } });
  await comment(repository, issue.number, `## Atualização aplicada\n\nOs metadados de **${target.record.name}** foram atualizados por @${approvedBy}. A alteração será publicada no próximo deploy.`);
  await setOutput("applied", "true");
  console.log(JSON.stringify({ issue: issue.number, entryIssue: request.entryIssue, applied: true, approvedBy }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
