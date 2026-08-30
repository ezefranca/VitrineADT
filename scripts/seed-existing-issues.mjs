import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { githubRequest } from "./github.mjs";
import { compareMentions } from "./mention-order.mjs";
import { resolveRepository } from "./repository.mjs";

const ROOT = process.cwd();
const APPS_DIRECTORY = path.join(ROOT, "data", "apps");
const ISSUE_LABELS = ["submission/seed", "validation/passed", "moderation/approved", "publication/queued"];

const args = process.argv.slice(2);
const argument = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};

function markerForRecord(record) {
  return `<!-- vitrineadt-real-issue: ${record.id} -->`;
}

function resolveLinks(links) {
  return [
    links?.website && `- Site ou página principal: ${links.website}`,
    links?.appStore && `- App Store: ${links.appStore}`,
    links?.googlePlay && `- Google Play: ${links.googlePlay}`,
    links?.source && `- Fonte / repositório: ${links.source}`
  ].filter(Boolean).join("\n");
}

function issueBodyForRecord(record) {
  const marker = markerForRecord(record);
  const mentions = (record.mentions ?? [])
    .slice()
    .sort(compareMentions)
    .map((mention) => `- Episódio ${mention.episode}: [${mention.title ?? "Menção"}](${mention.url ?? "#"}) (${mention.date ?? "data desconhecida"})`);

  return `${marker}
## ${record.name}

Entrada gerada automaticamente para o catálogo da VitrineADT a partir de um registro já existente no repositório do projeto.  
Esta Issue é o registro público do aplicativo e também recebe as reações 👍 usadas na vitrine.

### Desenvolvedor ou equipe

${record.developer?.name ?? "Autor desconhecido"}${record.developer?.url ? ` — ${record.developer.url}` : ""}

### Descrição

${record.description ?? ""}

### Plataformas

${(record.platforms ?? []).join(", ")}

### Links

${resolveLinks(record.links)}

### Menções verificadas

${mentions.join("\n")}
`;
}

async function readRecords() {
  await mkdir(APPS_DIRECTORY, { recursive: true });
  const files = (await readdir(APPS_DIRECTORY)).filter((name) => name.endsWith(".json")).sort();
  return Promise.all(files.map(async (name) => ({
    path: path.join(APPS_DIRECTORY, name),
    record: JSON.parse(await readFile(path.join(APPS_DIRECTORY, name), "utf8"))
  })));
}

async function listSeedIssues(repository) {
  const issues = [];
  for (let page = 1; page <= 10; page += 1) {
    const batch = await githubRequest(`/repos/${repository}/issues?state=all&labels=${encodeURIComponent("submission/seed")}&per_page=100&page=${page}`);
    issues.push(...batch.filter((item) => !item.pull_request));
    if (batch.length < 100) break;
  }
  return issues;
}

async function getIssue(repository, candidate, record) {
  if (!Number.isInteger(candidate)) return null;
  try {
    const issue = await githubRequest(`/repos/${repository}/issues/${candidate}`);
    if (String(issue.body ?? "").includes(markerForRecord(record))) return issue;
    if (String(issue.title ?? "") === `[App]: ${record.name}`) return issue;
  } catch {
    // sem correspondência, segue para criação
  }
  const searchIssue = await findIssueByTitle(repository, record);
  if (searchIssue) return searchIssue;
  return null;
}

async function findIssueByTitle(repository, record) {
  const query = encodeURIComponent(`repo:${repository} is:issue in:title "[App]: ${record.name}"`);
  const response = await githubRequest(`/search/issues?q=${query}`);
  return response.items?.find((issue) => String(issue.title ?? "") === `[App]: ${record.name}`) ?? null;
}

async function main() {
  const repositoryArg = argument("--repository", null);
  const dryRun = args.includes("--dry-run") || args.includes("--dryrun");
  const repository = await resolveRepository({ candidate: repositoryArg, root: ROOT });
  if (!repository) throw new Error("Não foi possível resolver o repositório GitHub. Use --repository ou defina GITHUB_REPOSITORY.");
  const records = await readRecords();
  let fixed = 0;
  let created = 0;
  let scanned = 0;

  const seedIssueIndex = await listSeedIssues(repository);
  const issuesByMarker = new Map();
  for (const issue of seedIssueIndex) {
    const marker = String(issue.body ?? "").match(/<!-- vitrineadt-real-issue:[^>]+-->/)?.[0];
    if (marker) issuesByMarker.set(marker, issue);
  }

  for (const item of records) {
    scanned += 1;
    const record = item.record;
    if (record.submission?.issueURL) continue;
    const marker = markerForRecord(record);

    let issue = issuesByMarker.get(marker);
    if (!issue) {
      const issueByNumber = await getIssue(repository, Number(record.submission?.issue), record);
      if (issueByNumber) {
        issue = issueByNumber;
      }
    }

    if (!issue) {
      if (dryRun) {
        console.log(`[dry-run] criaria issue para ${record.id} (${record.name})`);
        continue;
      }

      issue = await githubRequest(`/repos/${repository}/issues`, {
        method: "POST",
        body: {
          title: `[App]: ${record.name}`,
          body: issueBodyForRecord(record),
          labels: ISSUE_LABELS
        }
      });
      created += 1;
      issuesByMarker.set(marker, issue);
    }

    if (issue) {
      if (!record.submission) record.submission = {};
      record.submission.issue = issue.number;
      record.submission.issueURL = issue.html_url;
      if (!record.submission.submittedBy) record.submission.submittedBy = "seed-migration";
      if (!record.submission.approvedBy) record.submission.approvedBy = "seed-migration";
      if (!record.submission.approvedAt) record.submission.approvedAt = new Date().toISOString();

      if (Array.isArray(record.mentions)) {
        record.mentions = record.mentions.map((mention) => ({
          ...mention,
          submissionIssue: issue.number
        }));
      }
      await writeFile(item.path, `${JSON.stringify(record, null, 2)}\n`);
      fixed += 1;
      console.log(`OK: ${record.id} -> ${issue.number}`);
    }
  }

  if (dryRun) {
    console.log(`Simulação concluída. {scanned: ${scanned}, fixed: ${fixed}, created: ${created}}`);
  } else {
    console.log(`Migração concluída. {scanned: ${scanned}, updated: ${fixed}, created: ${created}}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
