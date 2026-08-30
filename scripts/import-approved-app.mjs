import { createHash } from "node:crypto";
import { readdir, readFile, mkdir, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";
import { githubRequest, repositoryFromEnvironment } from "./github.mjs";
import { compareMentions } from "./mention-order.mjs";
import { isLikelySameApp, slugify, validateSubmission } from "./submission.mjs";
import { downloadIcon, resolveIconURL } from "./images.mjs";

const ROOT = process.cwd();
const APPS_DIRECTORY = path.join(ROOT, "data", "apps");
const ICONS_DIRECTORY = path.join(ROOT, "public", "icons");
const ALLOWED_APPROVER_PERMISSIONS = new Set(["admin", "maintain", "write", "triage"]);

async function readCatalog() {
  await mkdir(APPS_DIRECTORY, { recursive: true });
  const names = (await readdir(APPS_DIRECTORY)).filter((name) => name.endsWith(".json"));
  return Promise.all(names.map(async (name) => ({
    name,
    path: path.join(APPS_DIRECTORY, name),
    record: JSON.parse(await readFile(path.join(APPS_DIRECTORY, name), "utf8"))
  })));
}

function mergeLinks(base, next) {
  return {
    website: next.website || base.website,
    appStore: next.appStore || base.appStore,
    googlePlay: next.googlePlay || base.googlePlay,
    source: next.source || base.source
  };
}

function mergedPlatforms(base, incoming) {
  return [...new Set([...(base ?? []), ...(incoming ?? [])])];
}

function mentionKey(mention) {
  return `${mention.show}/${mention.episode}/${mention.submissionIssue ?? ""}`;
}

function upsertMention(mentions, mention) {
  const next = [...mentions];
  const existing = next.some((item) => mentionKey(item) === mentionKey(mention));
  if (existing) return next;
  next.push(mention);
  next.sort(compareMentions);
  return next;
}

async function writeOutput(values) {
  if (!process.env.GITHUB_OUTPUT) return;
  await appendFile(process.env.GITHUB_OUTPUT, Object.entries(values).map(([key, value]) => `${key}=${value}\n`).join(""));
}

async function main() {
  if (!process.env.GITHUB_EVENT_PATH) throw new Error("GITHUB_EVENT_PATH não está definido.");
  const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, "utf8"));
  const issueNumber = event.issue?.number;
  const actor = event.sender?.login;
  if (!issueNumber || !actor) throw new Error("Evento de aprovação inválido.");

  const repository = repositoryFromEnvironment();
  const permission = await githubRequest(`/repos/${repository}/collaborators/${encodeURIComponent(actor)}/permission`);
  if (!ALLOWED_APPROVER_PERMISSIONS.has(permission.permission)) {
    throw new Error(`@${actor} não possui permissão de moderação suficiente.`);
  }

  const issue = await githubRequest(`/repos/${repository}/issues/${issueNumber}`);
  const result = await validateSubmission({ body: issue.body ?? "" });
  if (!new Set(["passed", "needs-review"]).has(result.status)) {
    throw new Error(`A submissão não pode ser importada com validação “${result.status}”.`);
  }

  const catalog = await readCatalog();
  const existing = catalog.find(({ record }) => isLikelySameApp(record, result.submission));
  const id = existing?.record.id ?? `${slugify(result.submission.name)}-${issueNumber}`;
  const mention = {
    show: "adt",
    segment: "Amigos do Área de Transferência",
    episode: result.episode.episodeNumber,
    title: result.episode.title,
    date: result.episode.date.slice(0, 10),
    url: result.episode.permalink,
    evidence: result.evidence.map((item) => item.type),
    submissionIssue: issueNumber
  };

  let record;
  let destination;
  if (existing) {
    record = existing.record;
    destination = existing.path;
    record.platforms = mergedPlatforms(record.platforms ?? [], result.submission.platforms ?? []);
    record.links = mergeLinks(record.links ?? {}, result.submission.links ?? {});
    record.description = result.submission.description || record.description;
    if (result.submission.developer?.name) {
      record.developer = { ...(record.developer ?? {}), name: result.submission.developer.name };
    }
    if (result.submission.developer?.url) {
      record.developer = { ...(record.developer ?? {}), url: result.submission.developer.url };
    }
    record.mentions = upsertMention(record.mentions ?? [], mention);
    record.updatedAt = new Date().toISOString();
  } else {
    record = {
      schemaVersion: 1,
      id,
      name: result.submission.name,
      description: result.submission.description,
      developer: result.submission.developer,
      platforms: result.submission.platforms,
      links: result.submission.links,
      icon: null,
      mentions: [mention],
      submission: {
        issue: issueNumber,
        issueURL: issue.html_url,
        submittedBy: issue.user?.login ?? "unknown",
        approvedBy: actor,
        approvedAt: new Date().toISOString()
      },
      updatedAt: new Date().toISOString()
    };
    destination = path.join(APPS_DIRECTORY, `${id}.json`);
  }

  if (!record.icon?.path) {
    const iconURL = await resolveIconURL(result.submission);
    if (iconURL) {
      const icon = await downloadIcon(iconURL);
      await mkdir(ICONS_DIRECTORY, { recursive: true });
      const fileName = `${id}.${icon.extension}`;
      await writeFile(path.join(ICONS_DIRECTORY, fileName), icon.bytes);
      record.icon = {
        path: `/icons/${fileName}`,
        sourceURL: icon.finalURL,
        sha256: createHash("sha256").update(icon.bytes).digest("hex")
      };
    }
  }

  record.mentions.sort(compareMentions);
  await writeFile(destination, `${JSON.stringify(record, null, 2)}\n`);
  await writeOutput({ app_id: id, issue_number: issueNumber, record_path: path.relative(ROOT, destination) });
  console.log(JSON.stringify({ id, issue: issueNumber, existing: Boolean(existing), record: path.relative(ROOT, destination) }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
