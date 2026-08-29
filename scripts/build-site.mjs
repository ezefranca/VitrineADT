import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { enrichCatalogApps, generateCatalogPages } from "./catalog-pages.mjs";

const args = process.argv.slice(2);
const argument = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};

const root = process.cwd();
const dataDirectory = path.resolve(root, argument("--data", "data/apps"));
const outputDirectory = path.resolve(root, argument("--output", "dist"));
const reactionsPath = path.resolve(root, argument("--reactions", ".generated/reactions.json"));
const repositoryArg = argument("--repository", process.env.GITHUB_REPOSITORY || process.env.VITRINEADT_REPOSITORY || null);
const isDemo = dataDirectory.includes(`${path.sep}tests${path.sep}fixtures${path.sep}`);

function validateRecord(record, fileName) {
  const errors = [];
  if (record.schemaVersion !== 1) errors.push("schemaVersion precisa ser 1");
  if (!record.id || !/^[a-z0-9-]+$/.test(record.id)) errors.push("id inválido");
  if (!record.name) errors.push("name ausente");
  if (!record.description) errors.push("description ausente");
  if (!record.developer?.name) errors.push("developer.name ausente");
  if (!Array.isArray(record.platforms) || record.platforms.length === 0) errors.push("platforms ausente");
  if (!record.links?.website) errors.push("links.website ausente");
  if (!Array.isArray(record.mentions) || record.mentions.length === 0) errors.push("mentions ausente");
  if (!Number.isInteger(record.submission?.issue)) errors.push("submission.issue ausente");
  if (errors.length) throw new Error(`${fileName}: ${errors.join(", ")}`);
}

async function loadJSONFiles(directory) {
  const entries = (await readdir(directory)).filter((name) => name.endsWith(".json")).sort();
  return Promise.all(entries.map(async (name) => {
    const record = JSON.parse(await readFile(path.join(directory, name), "utf8"));
    validateRecord(record, name);
    return record;
  }));
}

async function loadReactions() {
  try {
    return JSON.parse(await readFile(reactionsPath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
}

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(path.join(outputDirectory, "data"), { recursive: true });
await mkdir(path.join(outputDirectory, "icons"), { recursive: true });

const [records, reactions] = await Promise.all([loadJSONFiles(dataDirectory), loadReactions()]);
const repository = repositoryArg;
const repositoryURL = repository ? `https://github.com/${repository}` : null;

function likesForRecord(record) {
  const issues = new Set();
  if (Number.isInteger(record.submission?.issue)) issues.add(record.submission.issue);
  for (const mention of record.mentions ?? []) {
    if (Number.isInteger(mention.submissionIssue)) issues.add(mention.submissionIssue);
  }
  const total = [...issues].reduce((acc, issueNumber) => acc + Number(reactions[String(issueNumber)] ?? 0), 0);
  if (issues.size > 0) return total;
  return Number(record.likes ?? 0);
}

const apps = enrichCatalogApps(records.map((record) => ({
  ...record,
  likes: likesForRecord(record),
  submission: {
    ...record.submission,
    issueURL: record.submission.issueURL ?? (repositoryURL ? `${repositoryURL}/issues/${record.submission.issue}` : null)
  }
})));

await cp(path.join(root, "site"), outputDirectory, { recursive: true });
try {
  const icons = (await readdir(path.join(root, "public", "icons"))).filter((name) => /\.(png|jpe?g|webp)$/i.test(name));
  await Promise.all(icons.map((name) => cp(path.join(root, "public", "icons", name), path.join(outputDirectory, "icons", name))));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const generatedAt = new Date().toISOString();
await writeFile(path.join(outputDirectory, "data", "apps.json"), `${JSON.stringify({ generatedAt, repositoryURL, demo: isDemo, apps }, null, 2)}\n`);
await generateCatalogPages({ outputDirectory, apps, repositoryURL });
await cp(path.join(outputDirectory, "index.html"), path.join(outputDirectory, "404.html"));
await writeFile(path.join(outputDirectory, ".nojekyll"), "");
console.log(`Site gerado em ${path.relative(root, outputDirectory)} com ${apps.length} app(s).`);
