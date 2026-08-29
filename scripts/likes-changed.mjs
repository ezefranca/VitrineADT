import { appendFile, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { githubRequest } from "./github.mjs";
import { resolveRepository } from "./repository.mjs";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};

const ROOT = process.cwd();
const APP_DIRECTORY = path.resolve(ROOT, arg("--data", "data/apps"));
const REACTIONS_PATH = path.resolve(ROOT, arg("--reactions", ".generated/reactions.json"));
const OLD_CATALOG = path.resolve(ROOT, arg("--old", "dist/data/apps.json"));

function likesForRecord(record, reactions) {
  const issues = new Set();
  if (Number.isInteger(record.submission?.issue)) issues.add(record.submission.issue);
  for (const mention of record.mentions ?? []) {
    if (Number.isInteger(mention.submissionIssue)) issues.add(mention.submissionIssue);
  }
  return [...issues].reduce((acc, issueNumber) => acc + Number(reactions[String(issueNumber)] ?? 0), 0);
}

async function readJSON(file) {
  const data = await readFile(file, "utf8");
  return JSON.parse(data);
}

async function readCatalog(directory) {
  const files = (await readdir(directory)).filter((name) => name.endsWith(".json")).sort();
  return Promise.all(files.map(async (name) => JSON.parse(await readFile(path.join(directory, name), "utf8"))));
}

async function loadReactionsFromFile(filePath) {
  try {
    return await readJSON(filePath);
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
}

async function fetchReactions(repository, issueNumbers) {
  const counts = {};
  let cursor = 0;
  const allIssues = [...new Set(issueNumbers)];

  async function worker() {
    while (cursor < allIssues.length) {
      const issueNumber = allIssues[cursor];
      cursor += 1;
      try {
        const issue = await githubRequest(`/repos/${repository}/issues/${issueNumber}`);
        counts[String(issueNumber)] = Number(issue.reactions?.["+1"] ?? 0);
      } catch {
        counts[String(issueNumber)] = 0;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(8, allIssues.length) }, worker));
  return counts;
}

async function readCurrentLikes() {
  try {
    const catalog = await readJSON(OLD_CATALOG);
    return new Map((catalog.apps ?? []).map((item) => [item.id, Number(item.likes ?? 0)]));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function writeOutput(value) {
  if (!process.env.GITHUB_OUTPUT) return;
  const output = path.resolve(process.env.GITHUB_OUTPUT);
  return appendFile(output, `likes_changed=${String(value)}\n`);
}

const repository = await resolveRepository({ candidate: arg("--repository", null), root: ROOT });
if (!repository) throw new Error("Não foi possível resolver o repositório GitHub.");

const records = await readCatalog(APP_DIRECTORY);
const oldLikesById = await readCurrentLikes();
const issues = new Set();
for (const record of records) {
  if (Number.isInteger(record.submission?.issue)) issues.add(record.submission.issue);
  for (const mention of record.mentions ?? []) {
    if (Number.isInteger(mention.submissionIssue)) issues.add(mention.submissionIssue);
  }
}

let reactions = await loadReactionsFromFile(REACTIONS_PATH);
if (Object.keys(reactions).length === 0 && issues.size > 0) {
  reactions = await fetchReactions(repository, issues);
}

const nextLikesById = new Map(records.map((record) => [record.id, likesForRecord(record, reactions)]));
let changed = false;

if (oldLikesById === null) {
  changed = nextLikesById.size > 0;
} else {
  for (const [id, nextLikes] of nextLikesById) {
    if ((oldLikesById.get(id) ?? 0) !== nextLikes) {
      changed = true;
      break;
    }
  }
}

await writeOutput(changed);
console.log(`likes_changed=${changed}`);
if (!changed) {
  console.log("Sem alterações de curtidas detectadas. Nenhum redeploy será necessário.");
}
