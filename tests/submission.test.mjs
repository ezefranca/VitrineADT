import test from "node:test";
import assert from "node:assert/strict";
import { canonicalURL, compactText, extractFriendsSegment, isLikelySameApp, parseIssueForm, validateSubmission } from "../scripts/submission.mjs";

const issueBody = ({ name = "CleanupBuddy", developer = "Lucas Assis", episode = "493" } = {}) => `### Nome do aplicativo

${name}

### Desenvolvedor ou equipe

${developer}

### Site do desenvolvedor

https://example.com

### Descrição curta

Libera espaço no computador com uma experiência simples.

### Plataformas

- [x] macOS
- [ ] Android

### Link principal do aplicativo

https://cleanupbuddy.app/

### Link da App Store

_No response_

### Link do Google Play

_No response_

### Código-fonte

_No response_

### Número do episódio do Área de Transferência

${episode}

### Ajuda para encontrar a menção

No bloco de apps dos ouvintes.

### Link direto para o ícone

https://cleanupbuddy.app/icon.png

### Declarações

- [x] Primeira declaração
- [x] Segunda declaração
- [x] Terceira declaração
- [x] Quarta declaração
`;

function mockFetch({ transcript = "Amigos do ADT. Lucas Assis apresentou o Cleanup Buddy. Agora vamos aos follow-ups.", episodeStatus = 200 } = {}) {
  return async (url) => {
    if (String(url).endsWith(".json")) {
      return new Response(episodeStatus === 200 ? JSON.stringify({
        episodeNumber: 493,
        title: "493: Dança Macaquinho",
        date: "2026-08-28T15:53:00Z",
        permalink: "https://gigahertz.fm/podcasts/adt/493",
        updatedAt: "2026-08-28T18:58:53Z",
        body: '<h2>Links do Episódio</h2><ul><li><a href="https://cleanupbuddy.app/">CleanupBuddy</a></li></ul>'
      }) : "not found", { status: episodeStatus, headers: { "content-type": "application/json" } });
    }
    return new Response(transcript, { status: 200, headers: { "content-type": "text/plain" } });
  };
}

test("interpreta o formulário estruturado", () => {
  const submission = parseIssueForm(issueBody());
  assert.equal(submission.name, "CleanupBuddy");
  assert.deepEqual(submission.platforms, ["macos"]);
  assert.equal(submission.episode, 493);
  assert.equal(submission.declarationCount, 4);
});

test("normaliza nomes escritos com espaços", () => {
  assert.equal(compactText("Cleanup Buddy"), compactText("CleanupBuddy"));
});

test("isola o segmento Amigos do Área de Transferência", () => {
  const segment = extractFriendsSegment("Abertura. Amigos do ADT. App correto. Agora vamos aos follow-ups. Outro app.");
  assert.match(segment, /App correto/);
  assert.doesNotMatch(segment, /Outro app/);
});

test("remove parâmetros e www ao comparar URLs", () => {
  assert.equal(canonicalURL("https://www.cleanupbuddy.app/?utm_source=adt"), "cleanupbuddy.app/");
});

test("identifica o mesmo app por website normalizado", () => {
  const left = { name: "AppX", developer: { name: "Equipe", url: "" }, links: { website: "https://www.appar.com/?utm_source=adt", source: "", appStore: "", googlePlay: "" } };
  const right = { name: "appx", developer: { name: "Equipe", url: "" }, links: { website: "https://appar.com", source: "", appStore: "", googlePlay: "" } };
  assert.equal(isLikelySameApp(left, right), true);
});

test("identifica o mesmo app por nome e desenvolvedor normalizado", () => {
  const left = { name: "Meu App ", developer: { name: "Acme LTDA", url: "" }, links: { website: "", source: "", appStore: "", googlePlay: "" } };
  const right = { name: "Meu App", developer: { name: "ACME LTDA", url: "" }, links: { website: "", source: "", appStore: "", googlePlay: "" } };
  assert.equal(isLikelySameApp(left, right), true);
});

test("aprova evidência forte nas notas e na transcrição", async () => {
  const result = await validateSubmission({ body: issueBody(), fetchImpl: mockFetch() });
  assert.equal(result.status, "passed");
  assert.ok(result.evidence.some((item) => item.type === "notes-link"));
  assert.ok(result.evidence.some((item) => item.type === "friends-segment-name"));
});

test("não aprova uma menção fora do segmento Amigos do Área de Transferência", async () => {
  const result = await validateSubmission({
    body: issueBody(),
    fetchImpl: mockFetch({ transcript: "CleanupBuddy apareceu na abertura. Amigos do ADT. Outro projeto. Agora vamos aos follow-ups." })
  });
  assert.equal(result.status, "needs-review");
});

test("encaminha correspondência inconclusiva para revisão humana", async () => {
  const result = await validateSubmission({
    body: issueBody({ name: "Outro App", developer: "Outra Pessoa" }),
    fetchImpl: mockFetch({ transcript: "Nenhuma correspondência útil nesta transcrição." })
  });
  assert.equal(result.status, "needs-review");
  assert.equal(result.errors.length, 0);
});

test("reprova episódio inexistente", async () => {
  const result = await validateSubmission({ body: issueBody(), fetchImpl: mockFetch({ episodeStatus: 404 }) });
  assert.equal(result.status, "failed");
});
