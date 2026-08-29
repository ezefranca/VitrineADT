import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile(new URL("../data/bootstrap/adt-484-493.json", import.meta.url), "utf8"));

test("a base inicial representa exatamente dez episódios", () => {
  assert.equal(manifest.source.episodeCount, 10);
  assert.equal(manifest.episodes.length, 10);
  assert.deepEqual(manifest.episodes.map((entry) => entry.episode), [493, 492, 491, 490, 489, 488, 487, 486, 485, 484]);
});

test("as entradas iniciais possuem identidade e links públicos válidos", () => {
  const apps = manifest.episodes.flatMap((entry) => entry.apps);
  assert.equal(apps.length, 18);
  assert.equal(new Set(apps.map((app) => app.name)).size, apps.length);

  for (const app of apps) {
    assert.ok(app.name);
    assert.ok(app.developer?.name);
    assert.ok(app.description);
    assert.ok(app.platforms.length > 0);
    assert.doesNotThrow(() => {
      const url = new URL(app.links.website);
      assert.equal(url.protocol, "https:");
    });
  }
});
