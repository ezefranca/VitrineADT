import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { githubRequest, repositoryFromEnvironment } from "./github.mjs";

const outputArgument = process.argv.indexOf("--output");
const outputPath = path.resolve(process.cwd(), outputArgument >= 0 ? process.argv[outputArgument + 1] : ".generated/reactions.json");
const appsDirectory = path.resolve(process.cwd(), "data/apps");
const repository = repositoryFromEnvironment();
const issueNumbers = [];

for (const fileName of (await readdir(appsDirectory)).filter((name) => name.endsWith(".json"))) {
  const record = JSON.parse(await readFile(path.join(appsDirectory, fileName), "utf8"));
  if (Number.isInteger(record.submission?.issue)) issueNumbers.push(record.submission.issue);
  for (const mention of record.mentions ?? []) {
    if (Number.isInteger(mention.submissionIssue)) issueNumbers.push(mention.submissionIssue);
  }
}

const uniqueIssues = [...new Set(issueNumbers)];
const counts = {};
let cursor = 0;

async function worker() {
  while (cursor < uniqueIssues.length) {
    const issueNumber = uniqueIssues[cursor];
    cursor += 1;
    try {
      const issue = await githubRequest(`/repos/${repository}/issues/${issueNumber}`);
      counts[String(issueNumber)] = Number(issue.reactions?.["+1"] ?? 0);
    } catch (error) {
      counts[String(issueNumber)] = 0;
      console.warn(`Não foi possível consultar as reações da Issue #${issueNumber}: ${error.message}`);
    }
  }
}

await Promise.all(Array.from({ length: Math.min(8, uniqueIssues.length) }, worker));
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(counts, null, 2)}\n`);
console.log(`Curtidas coletadas de ${uniqueIssues.length} Issue(s).`);
