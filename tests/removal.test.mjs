import test from "node:test";
import assert from "node:assert/strict";
import { isOriginalSubmitter, parseRemovalTarget } from "../scripts/removal.mjs";

test("identifica a Issue original em um pedido de remoção", () => {
  const body = "### Issue da entrada\n\nhttps://github.com/exemplo/vitrineadt/issues/42\n\n### Pedido\n\nRemover.";
  assert.equal(parseRemovalTarget(body), 42);
});

test("não usa números fora do campo da Issue da entrada", () => {
  assert.equal(parseRemovalTarget("### Pedido\n\nRemover a Issue 42."), null);
});

test("autoriza somente a conta exata da submissão", () => {
  const record = { submission: { submittedBy: "IndieDev" } };
  assert.equal(isOriginalSubmitter(record, "indiedev"), true);
  assert.equal(isOriginalSubmitter(record, "outra-pessoa"), false);
  assert.equal(isOriginalSubmitter({ submission: { submittedBy: "github-actions[bot]" } }, "github-actions[bot]"), false);
});
