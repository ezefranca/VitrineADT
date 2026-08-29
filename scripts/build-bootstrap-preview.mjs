import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { downloadIcon, resolveIconURL } from "./images.mjs";
import { slugify } from "./submission.mjs";
import { enrichCatalogApps, generateCatalogPages } from "./catalog-pages.mjs";

const ROOT = process.cwd();
const OUTPUT = path.join(ROOT, ".preview");
const manifest = JSON.parse(await readFile(path.join(ROOT, "data", "bootstrap", "adt-484-493.json"), "utf8"));

async function episodeDetails(number) {
  const response = await fetch(`https://gigahertz.fm/api/podcasts/adt/${number}.json`, {
    headers: { Accept: "application/json", "User-Agent": "VitrineADTGallery/0.1" },
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) throw new Error(`Não foi possível obter o episódio ${number}: HTTP ${response.status}`);
  return response.json();
}

await rm(OUTPUT, { recursive: true, force: true });
await cp(path.join(ROOT, "site"), OUTPUT, { recursive: true });
await mkdir(path.join(OUTPUT, "data"), { recursive: true });
await mkdir(path.join(OUTPUT, "icons"), { recursive: true });

const episodes = new Map((await Promise.all(manifest.episodes.map(async (entry) => {
  const details = await episodeDetails(entry.episode);
  return [entry.episode, details];
}))).map((entry) => entry));

const apps = [];
for (const entry of manifest.episodes) {
  const episode = episodes.get(entry.episode);
  for (const app of entry.apps) {
    const id = `${slugify(app.name)}-preview`;
    let icon = null;
    try {
      const iconURL = await resolveIconURL({ ...app, iconURL: "" });
      if (iconURL) {
        const downloaded = await downloadIcon(iconURL);
        const fileName = `${id}.${downloaded.extension}`;
        await writeFile(path.join(OUTPUT, "icons", fileName), downloaded.bytes);
        icon = { path: `/icons/${fileName}`, sourceURL: downloaded.finalURL };
      }
    } catch (error) {
      console.warn(`Prévia sem ícone para ${app.name}: ${error.message}`);
    }

    apps.push({
      schemaVersion: 1,
      id,
      name: app.name,
      description: app.description,
      developer: app.developer,
      platforms: app.platforms,
      links: app.links,
      icon,
      mentions: [{
        show: "adt",
        segment: "Amigos do Área de Transferência",
        episode: Number(episode.episodeNumber),
        title: String(episode.title),
        date: String(episode.date).slice(0, 10),
        url: String(episode.permalink),
        evidence: ["gigahertz-api", "episode-notes", "friends-segment"],
        submissionIssue: null
      }],
      submission: { issue: null, issueURL: null },
      likes: 0,
      updatedAt: String(episode.updatedAt ?? episode.date)
    });
  }
}

const enrichedApps = enrichCatalogApps(apps);
await writeFile(path.join(OUTPUT, "data", "apps.json"), `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  repositoryURL: null,
  demo: false,
  preview: true,
  likesAvailable: false,
  notice: "Prévia local com dados reais verificados. Curtidas e formulários serão ativados quando as Issues forem criadas no GitHub.",
  apps: enrichedApps
}, null, 2)}\n`);
await generateCatalogPages({ outputDirectory: OUTPUT, apps: enrichedApps, repositoryURL: null });

await cp(path.join(OUTPUT, "index.html"), path.join(OUTPUT, "404.html"));
await writeFile(path.join(OUTPUT, ".nojekyll"), "");
console.log(`Prévia real gerada com ${apps.length} aplicativos.`);
