import { readFile } from "node:fs/promises";
import { formatValidationReport, validateSubmission, validationLabelFor } from "./submission.mjs";
import { repositoryFromEnvironment, replaceStateLabels, upsertIssueComment } from "./github.mjs";

async function main() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) throw new Error("GITHUB_EVENT_PATH não está definido.");
  const event = JSON.parse(await readFile(eventPath, "utf8"));
  const issue = event.issue;
  if (!issue?.number) throw new Error("O evento não contém uma Issue.");

  const result = await validateSubmission({ body: issue.body ?? "" });
  const repository = repositoryFromEnvironment();
  const report = formatValidationReport(result);

  await upsertIssueComment({
    repository,
    issueNumber: issue.number,
    marker: "<!-- vitrineadt-validation-report -->",
    body: report
  });

  const statusLabels = result.status === "failed"
    ? [validationLabelFor(result.status)]
    : [validationLabelFor(result.status), "status/awaiting-moderation"];

  await replaceStateLabels({
    repository,
    issueNumber: issue.number,
    currentLabels: issue.labels ?? [],
    add: statusLabels,
    prefixes: ["validation/", "status/"],
    removeExact: ["validation/recheck"]
  });

  console.log(JSON.stringify({ issue: issue.number, status: result.status, evidence: result.evidence.length }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
