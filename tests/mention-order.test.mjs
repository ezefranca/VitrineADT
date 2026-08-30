import test from "node:test";
import assert from "node:assert/strict";
import { compareAppsByLatestMention, compareMentions, latestMention } from "../scripts/mention-order.mjs";

test("usa o episódio mais alto como a última menção, mesmo quando o registro é antigo", () => {
  const app = {
    mentions: [
      { episode: 493, date: "2026-08-28" },
      { episode: 494, date: "2026-09-04" },
      { episode: 492, date: "2026-08-21" }
    ]
  };
  assert.equal(latestMention(app).episode, 494);
});

test("mantém uma reaparição no topo de Últimas menções", () => {
  const recurringApp = { mentions: [{ episode: 494, date: "2026-09-04" }] };
  const newlyAddedApp = { mentions: [{ episode: 493, date: "2026-08-28" }] };
  assert.ok(compareAppsByLatestMention(recurringApp, newlyAddedApp) < 0);
});

test("usa a data somente para desempatar o episódio", () => {
  const newerDate = { episode: 493, date: "2026-08-29" };
  const olderDate = { episode: 493, date: "2026-08-28" };
  assert.ok(compareMentions(newerDate, olderDate) < 0);
});
