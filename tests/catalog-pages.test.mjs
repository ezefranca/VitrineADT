import test from "node:test";
import assert from "node:assert/strict";
import { enrichCatalogApps, formatDate, groupAppsByEpisode } from "../scripts/catalog-pages.mjs";

test("formata datas do catálogo para leitura humana em português", () => {
  assert.equal(formatDate("2026-08-02"), "02 de agosto de 2026");
});

test("não transforma o autor da submissão no desenvolvedor do aplicativo", () => {
  const [app] = enrichCatalogApps([{
    name: "Bollywood",
    developer: { name: "Arthur Givigir" },
    links: { source: "" },
    submission: { submittedBy: "ezefranca" }
  }]);

  assert.equal(app.author, null);
});

test("associa o autor somente quando existe um repositório-fonte público", () => {
  const [app] = enrichCatalogApps([{
    name: "Exemplo",
    developer: { name: "Equipe Exemplo" },
    links: { source: "https://github.com/exemplo/app" },
    submission: { submittedBy: "outra-pessoa" }
  }]);

  assert.deepEqual(app.author, {
    username: "exemplo",
    url: "https://github.com/exemplo",
    source: "source-repository",
    path: "author/exemplo/"
  });
});

test("usa o perfil GitHub informado do desenvolvedor", () => {
  const [app] = enrichCatalogApps([{
    name: "Bollywood",
    developer: { name: "Arthur Givigir", url: "https://github.com/arthurgivigir" },
    links: { source: "" },
    submission: { submittedBy: "ezefranca" }
  }]);

  assert.deepEqual(app.author, {
    username: "arthurgivigir",
    url: "https://github.com/arthurgivigir",
    source: "developer-profile",
    path: "author/arthurgivigir/"
  });
});

test("agrupa todos os apps por episódio e remove menções duplicadas", () => {
  const apps = enrichCatalogApps([
    {
      id: "b",
      name: "Beta",
      developer: { name: "B" },
      links: {},
      mentions: [{ episode: 10, title: "Dez", date: "2026-01-02", url: "https://gigahertz.fm/podcasts/adt/10" }]
    },
    {
      id: "a",
      name: "Alpha",
      developer: { name: "A" },
      links: {},
      mentions: [
        { episode: 10, title: "Dez", date: "2026-01-02", url: "https://gigahertz.fm/podcasts/adt/10" },
        { episode: 9, title: "Nove", date: "2025-12-20", url: "https://gigahertz.fm/podcasts/adt/9" }
      ]
    },
    {
      id: "c",
      name: "Charlie",
      developer: { name: "C" },
      links: {},
      mentions: [{ episode: 9, title: "Nove", date: "2025-12-20", url: "https://gigahertz.fm/podcasts/adt/9" }]
    }
  ]);

  assert.deepEqual(groupAppsByEpisode(apps).map((episode) => [episode.episode, episode.apps.map((app) => app.name)]), [
    [10, ["Alpha", "Beta"]],
    [9, ["Alpha", "Charlie"]]
  ]);
});
