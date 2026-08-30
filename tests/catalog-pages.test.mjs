import test from "node:test";
import assert from "node:assert/strict";
import { enrichCatalogApps } from "../scripts/catalog-pages.mjs";

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
