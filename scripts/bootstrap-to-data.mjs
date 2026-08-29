import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { downloadIcon, resolveIconURL } from "./images.mjs";
import { isLikelySameApp, slugify } from "./submission.mjs";

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, "data", "bootstrap", "adt-484-493.json");
const OUTPUT_DIRECTORY = path.join(ROOT, "data", "apps");
const ICONS_DIRECTORY = path.join(ROOT, "public", "icons");

function normalizeIssueNumber(episode, index) {
  const sequence = String(index + 1).padStart(2, "0");
  return Number.parseInt(`${episode}${sequence}`, 10);
}

function resolveEvidence() {
  return ["gigahertz-api-bootstrap", "episode-notes", "friends-segment"];
}

async function fetchEpisode(episodeNumber) {
  const response = await fetch(`https://gigahertz.fm/api/podcasts/adt/${episodeNumber}.json`, {
    headers: { Accept: "application/json", "User-Agent": "VitrineADTGallery/0.1 (+bootstrap-import)" },
    signal: AbortSignal.timeout(12_000)
  });
  if (!response.ok) throw new Error(`Não foi possível consultar o episódio ${episodeNumber}: HTTP ${response.status}`);
  return response.json();
}

async function buildIcon(record) {
  try {
    const iconURL = await resolveIconURL({ ...record, iconURL: record.iconURL ?? "" });
    if (!iconURL) return null;
    const downloaded = await downloadIcon(iconURL);
    const fileName = `${record.id}.${downloaded.extension}`;
    await writeFile(path.join(ICONS_DIRECTORY, fileName), downloaded.bytes);
    return {
      path: `/icons/${fileName}`,
      sourceURL: downloaded.finalURL
    };
  } catch {
    return null;
  }
}

function mergePlatforms(base = [], incoming = []) {
  return [...new Set([...(base ?? []), ...(incoming ?? [])])];
}

function mergeLinks(base = {}, next = {}) {
  return {
    website: next.website || base.website,
    appStore: next.appStore || base.appStore,
    googlePlay: next.googlePlay || base.googlePlay,
    source: next.source || base.source
  };
}

function upsertMention(mentions = [], mention) {
  const next = [...mentions];
  const exists = next.some((item) => item.episode === mention.episode && item.submissionIssue === mention.submissionIssue);
  if (!exists) next.push(mention);
  next.sort((a, b) => b.episode - a.episode || b.date.localeCompare(a.date));
  return next;
}

const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
const generatedAt = new Date().toISOString();

if (manifest.schemaVersion !== 1) {
  throw new Error("Manifesto inicial inválido para importação.");
}

const episodes = await Promise.all(
  manifest.episodes.map(async (entry) => {
    const episode = await fetchEpisode(entry.episode);
    return [entry.episode, episode];
  })
);
const episodeIndex = new Map(episodes);

await rm(OUTPUT_DIRECTORY, { recursive: true, force: true });
await mkdir(OUTPUT_DIRECTORY, { recursive: true });
await rm(ICONS_DIRECTORY, { recursive: true, force: true });
await mkdir(ICONS_DIRECTORY, { recursive: true });

const records = [];
for (const entry of manifest.episodes) {
  const episode = episodeIndex.get(entry.episode);
  for (let index = 0; index < entry.apps.length; index += 1) {
    const app = entry.apps[index];
    const submissionIssue = normalizeIssueNumber(entry.episode, index);
    const id = `${slugify(app.name)}-${submissionIssue}`;
    const title = String(episode?.title ?? `ADT ${entry.episode}`);
    const date = String(episode?.date ?? "").slice(0, 10);
    const permalink = String(episode?.permalink ?? `https://gigahertz.fm/podcasts/adt/${entry.episode}`);
    const incoming = {
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
        episode: Number(entry.episode),
        title,
        date,
        url: permalink,
        evidence: resolveEvidence(),
        submissionIssue
      }],
      submission: {
        issue: submissionIssue,
        issueURL: null,
        submittedBy: "bootstrap-curation",
        approvedBy: "bootstrap-curation",
        approvedAt: generatedAt
      },
      likes: 0,
      updatedAt: generatedAt,
      source: {
        kind: "gigahertz-api-bootstrap",
        manifest: "data/bootstrap/adt-484-493.json"
      }
    };
    incoming.icon = await buildIcon({ ...app, id });
    const existing = records.find((record) => isLikelySameApp(record, incoming));
    if (existing) {
      existing.mentions = upsertMention(existing.mentions, incoming.mentions[0]);
      existing.platforms = mergePlatforms(existing.platforms, incoming.platforms);
      existing.links = mergeLinks(existing.links, incoming.links);
      existing.name = incoming.name || existing.name;
      existing.description = incoming.description || existing.description;
      if (incoming.developer?.name) {
        existing.developer = { ...(existing.developer ?? {}), name: incoming.developer.name };
      }
      if (incoming.developer?.url) {
        existing.developer = { ...(existing.developer ?? {}), url: incoming.developer.url };
      }
      if (!existing.icon?.path) {
        existing.icon = incoming.icon;
      }
      existing.updatedAt = generatedAt;
    } else {
      records.push(incoming);
    }
  }
}

for (const record of records) {
  const file = path.join(OUTPUT_DIRECTORY, `${record.id}.json`);
  await writeFile(file, `${JSON.stringify(record, null, 2)}\n`);
}

console.log(`Catálogo importado para ${path.relative(ROOT, OUTPUT_DIRECTORY)}: ${records.length} app(s).`);
