import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { githubRequest, repositoryFromEnvironment } from "./github.mjs";
import { downloadIcon, resolveIconURL } from "./images.mjs";
import { canonicalURL, compactText, extractFriendsSegment, extractLinks, slugify } from "./submission.mjs";

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, "data", "bootstrap", "adt-484-493.json");
const APPS_DIRECTORY = path.join(ROOT, "data", "apps");
const ICONS_DIRECTORY = path.join(ROOT, "public", "icons");
const API_ROOT = "https://gigahertz.fm/api/podcasts/adt";
const ISSUE_LABELS = ["submission/seed", "validation/passed", "moderation/approved", "publication/queued"];

async function fetchText(url, maximum = 2_000_000) {
  const response = await fetch(url, {
    headers: { Accept: "application/json,text/plain;q=0.9", "User-Agent": "VitrineADTGallery/0.1" },
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} ao consultar ${url}`);
  const text = await response.text();
  if (Buffer.byteLength(text, "utf8") > maximum) throw new Error(`Resposta de ${url} excede o limite permitido.`);
  return text;
}

async function fetchJSON(url) {
  return JSON.parse(await fetchText(url, 2_000_000));
}

function markerFor(episode, app) {
  return `<!-- vitrineadt-seed: adt-${episode}-${slugify(app.name)} -->`;
}

function appMatchesSegment(app, segment) {
  const compactSegment = compactText(segment);
  const candidates = [app.name, app.developer?.name, ...(app.mentionTerms ?? [])]
    .map(compactText)
    .filter((term) => term.length >= 4);
  return candidates.some((term) => compactSegment.includes(term));
}

function appLinkAppearsInNotes(app, notesHTML) {
  const submitted = [app.links.website, app.links.appStore, app.links.googlePlay, app.links.source]
    .map(canonicalURL)
    .filter(Boolean);
  return extractLinks(notesHTML).some((link) => submitted.includes(canonicalURL(link.url)));
}

function issueBody({ app, episode, marker }) {
  const platforms = app.platforms.join(", ");
  const links = [
    app.links.website && `- Site ou página principal: ${app.links.website}`,
    app.links.appStore && `- App Store: ${app.links.appStore}`,
    app.links.googlePlay && `- Google Play: ${app.links.googlePlay}`,
    app.links.source && `- Código-fonte: ${app.links.source}`
  ].filter(Boolean).join("\n");

  return `${marker}
## ${app.name}

Entrada inicial criada a partir das fontes públicas do episódio [${episode.title}](${episode.permalink}). Esta Issue é o registro público do aplicativo e também recebe as reações 👍 usadas na seção de favoritos.

### Desenvolvedor ou equipe

${app.developer.name}${app.developer.url ? ` — ${app.developer.url}` : ""}

### Descrição

${app.description}

### Plataformas

${platforms}

### Links

${links}

### Menção verificada

- Programa: Área de Transferência
- Segmento: **Amigos do Área de Transferência**
- Episódio: [${episode.title}](${episode.permalink})
- Data: ${String(episode.date).slice(0, 10)}
- Fontes consultadas: API oficial, notas e transcrição pública do episódio

### Origem desta Issue

Esta é uma entrada editorial de inicialização do catálogo, não uma declaração feita pelo titular. Informações incorretas podem ser denunciadas e o titular pode solicitar remoção pelos formulários do projeto.
`;
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

async function readRecords() {
  await mkdir(APPS_DIRECTORY, { recursive: true });
  const files = (await readdir(APPS_DIRECTORY)).filter((name) => name.endsWith(".json"));
  return Promise.all(files.map(async (name) => ({
    path: path.join(APPS_DIRECTORY, name),
    record: JSON.parse(await readFile(path.join(APPS_DIRECTORY, name), "utf8"))
  })));
}

async function attachIcon(record, app) {
  if (record.icon?.path) return;
  try {
    const iconURL = await resolveIconURL({ ...app, iconURL: "" });
    if (!iconURL) return;
    const icon = await downloadIcon(iconURL);
    await mkdir(ICONS_DIRECTORY, { recursive: true });
    const fileName = `${record.id}.${icon.extension}`;
    await writeFile(path.join(ICONS_DIRECTORY, fileName), icon.bytes);
    record.icon = {
      path: `/icons/${fileName}`,
      sourceURL: icon.finalURL,
      sha256: createHash("sha256").update(icon.bytes).digest("hex")
    };
  } catch (error) {
    console.warn(`Ícone de ${app.name} não foi importado: ${error.message}`);
  }
}

async function writeOutput(values) {
  if (!process.env.GITHUB_OUTPUT) return;
  await appendFile(process.env.GITHUB_OUTPUT, Object.entries(values).map(([key, value]) => `${key}=${value}\n`).join(""));
}

async function main() {
  const verifyOnly = process.argv.includes("--verify-only");
  const repository = verifyOnly ? null : repositoryFromEnvironment();
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  const index = await fetchJSON(`${API_ROOT}/index.json`);
  const indexedEpisodes = new Map(index.episodes.map((episode) => [Number(episode.episodeNumber), episode]));
  const manifestEpisodes = manifest.episodes.map((entry) => entry.episode);

  if (manifest.schemaVersion !== 1 || manifestEpisodes.length !== manifest.source.episodeCount) {
    throw new Error("O manifesto inicial é inválido ou não contém exatamente dez episódios.");
  }
  for (const episodeNumber of manifestEpisodes) {
    if (!indexedEpisodes.has(episodeNumber)) throw new Error(`O episódio ${episodeNumber} não aparece no índice oficial.`);
  }

  const [existingIssues, records] = verifyOnly
    ? [[], []]
    : await Promise.all([listSeedIssues(repository), readRecords()]);
  const issueByMarker = new Map();
  for (const issue of existingIssues) {
    const marker = String(issue.body ?? "").match(/<!-- vitrineadt-seed: [^>]+ -->/)?.[0];
    if (marker) issueByMarker.set(marker, issue);
  }

  let createdIssues = 0;
  let writtenRecords = 0;
  for (const entry of manifest.episodes) {
    const episode = await fetchJSON(`${API_ROOT}/${entry.episode}.json`);
    const transcript = await fetchText(`${episode.permalink}.txt`);
    const segment = extractFriendsSegment(transcript);

    if (entry.apps.length > 0 && !segment) {
      throw new Error(`O segmento Amigos do Área de Transferência não foi identificado no episódio ${entry.episode}.`);
    }

    for (const app of entry.apps) {
      if (!appLinkAppearsInNotes(app, String(episode.body ?? ""))) {
        throw new Error(`${app.name}: nenhum link oficial foi encontrado nas notas do episódio ${entry.episode}.`);
      }
      if (!appMatchesSegment(app, segment)) {
        throw new Error(`${app.name}: a menção não foi encontrada dentro do segmento Amigos do Área de Transferência do episódio ${entry.episode}.`);
      }
      if (verifyOnly) {
        console.log(`Verificado: ADT ${entry.episode} — ${app.name}`);
        continue;
      }

      const marker = markerFor(entry.episode, app);
      let issue = issueByMarker.get(marker);
      if (!issue) {
        issue = await githubRequest(`/repos/${repository}/issues`, {
          method: "POST",
          body: {
            title: `[App]: ${app.name}`,
            body: issueBody({ app, episode, marker }),
            labels: ISSUE_LABELS
          }
        });
        issueByMarker.set(marker, issue);
        createdIssues += 1;
        console.log(`Issue #${issue.number} criada para ${app.name}.`);
      } else {
        console.log(`Issue #${issue.number} reaproveitada para ${app.name}.`);
      }

      const id = `${slugify(app.name)}-${issue.number}`;
      const existing = records.find(({ record }) => record.submission?.issue === issue.number);
      const record = existing?.record ?? {
        schemaVersion: 1,
        id,
        name: app.name,
        description: app.description,
        developer: app.developer,
        platforms: app.platforms,
        links: app.links,
        icon: null,
        mentions: [{
          show: "adt",
          segment: "Amigos do Área de Transferência",
          episode: Number(episode.episodeNumber),
          title: String(episode.title),
          date: String(episode.date).slice(0, 10),
          url: String(episode.permalink),
          evidence: ["gigahertz-api", "episode-notes", "friends-segment"],
          submissionIssue: issue.number
        }],
        submission: {
          issue: issue.number,
          issueURL: issue.html_url,
          submittedBy: "github-actions[bot]",
          approvedBy: "bootstrap-curation",
          approvedAt: new Date().toISOString()
        },
        source: {
          kind: "gigahertz-api-bootstrap",
          manifest: "data/bootstrap/adt-484-493.json"
        },
        updatedAt: new Date().toISOString()
      };

      await attachIcon(record, app);
      const destination = existing?.path ?? path.join(APPS_DIRECTORY, `${id}.json`);
      await writeFile(destination, `${JSON.stringify(record, null, 2)}\n`);
      if (!existing) records.push({ path: destination, record });
      writtenRecords += 1;
    }
  }

  if (verifyOnly) {
    console.log(`Manifesto verificado na API oficial: ${manifestEpisodes.length} episódios.`);
    return;
  }

  await writeOutput({ created_issues: createdIssues, written_records: writtenRecords });
  console.log(`Importação concluída: ${createdIssues} Issue(s) criada(s), ${writtenRecords} registro(s) verificado(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
