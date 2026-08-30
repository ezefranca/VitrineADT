# VitrineADT

Galeria pública e independente de aplicativos apresentados no segmento **Amigos do Área de Transferência**.

## Em uma frase

Tudo no projeto é versionado em arquivo:

- submissões e moderação no GitHub via Issues;
- catálogo no diretório `data/apps`;
- publicação por GitHub Pages a partir de `dist/` gerado em release.

## Sumário

- [Arquitetura](#arquitetura)
- [Como funciona](#como-funciona)
- [Como submeter um app](#como-submeter-um-app)
- [Como moderar e publicar](#como-moderar-e-publicar)
- [Integrações externas](#integrações-externas)
- [Estrutura do repositório](#estrutura-do-repositório)
- [Como rodar localmente](#como-rodar-localmente)
- [Comandos por objetivo](#comandos-por-objetivo)
- [Troubleshooting](#troubleshooting)

## Arquitetura

Consulte a visão completa em [`arquitetura.md`](arquitetura.md).

Resumo objetivo:

- `data/apps/*.json` é a fonte canônica do catálogo.
- `public/icons/*` guarda ícones baixados.
- `scripts/build-site.mjs` gera `dist/` com:
  - HTML da home + páginas institucionais;
  - páginas por app (`/apps/{slug}/`);
  - páginas por autor (`/author/{username}/`);
  - `dist/data/apps.json` com dados de catálogo e curtidas.
- `npm run dev` serve `dist/`.
- Workflow `publish-release` publica `dist/` no GitHub Pages.

## Como funciona

### 1) Entrada

1. A pessoa abre uma Issue com o template de app.
2. Workflow `validate-submission` valida campos e evidência (episódio + notas + transcrição).
3. A Issue recebe um estado:
   - aprovação técnica (`validation/passed` ou `validation/needs-review`);
   - ou falha (`validation/failed`).

### 2) Aprovação editorial

1. Moderador revisa a Issue e marca `moderation/approved` para entrar na fila.
2. Workflow `queue-approved-app` importa/atualiza o app no `data/apps`.
3. A Issue recebe `publication/queued`.

### 3) Publicação

1. Uma release é criada no GitHub.
2. Workflow `publish-release`:
   - busca reações 👍;
   - gera `dist/`;
   - publica Pages;
   - marca `publication/published` nas Issues incluídas.

### 4) Remoções

1. Pedido via template `removal.yml` em `removal/new`.
2. Se o solicitante for o titular original, a remoção é tratada diretamente.
3. Se não, entra em `removal/awaiting-moderation` e precisa da aprovação humana.
4. A retirada final aparece no próximo ciclo de release.

## Como submeter um app

1. Acesse a página de novo issue no GitHub do repositório.
2. Preencha os campos obrigatórios do template.
3. Aguarde validação automática (`validation/*`).
4. Se necessário, responda dúvidas apontadas.
5. Após `moderation/approved`, o app aguarda publicação por release.

## Como moderar e publicar

## Labels que importam

- Entrada/validação: `submission/new`, `validation/passed`, `validation/needs-review`, `validation/failed`, `validation/source-unavailable`, `validation/recheck`
- Estado: `status/awaiting-moderation`
- Editorial: `moderation/approved`, `moderation/rejected`
- Publicação: `publication/queued`, `publication/published`
- Remoção: `removal/new`, `removal/awaiting-moderation`, `removal/approved`, `removal/completed`, `removal/failed`

### Publicação manual

1. Crie uma release no GitHub apontando para o commit mais recente da branch padrão.
2. Aguarde `publish-release` concluir.
3. A URL publicada ficará no comentário da Issue.

Não há deploy automático em push. A publicação só sobe no evento de release.

## Integrações externas

O site publicado é estático e não consulta a API do Gigahertz durante a navegação. A API é usada nos scripts de validação antes de um app entrar no catálogo:

- `scripts/submission.mjs` consulta `https://gigahertz.fm/api/podcasts/adt/{episódio}.json` para confirmar o episódio, título, data, permalink e notas públicas.
- `scripts/submission.mjs` consulta `https://gigahertz.fm/podcasts/adt/{episódio}.txt` para verificar a menção no trecho “Amigos do Área de Transferência”.
- Os resultados verificados são gravados como snapshot em `data/apps/*.json`, em `mentions[]`, com episódio, data, URL e evidências.
- `scripts/github.mjs` e os scripts de publicação usam a API do GitHub para Issues, reações e Pages.

Não comite `dist/` no fluxo de manutenção do catálogo; ele é gerado no build/release.

## Estrutura do repositório

- `site/`
  - UI estática da home e páginas institucionais.
- `scripts/`
  - automações, integração com GitHub API e construção do site.
- `data/`
  - `apps/` (catálogo canônico)
- `public/icons/`
  - ícones versionados no repositório.
- `dist/`
  - saída pronta para publicação.
- `tests/fixtures/apps/`
  - dados de demonstração para CI.
- `.github/`
  - templates de Issue e workflows.

## Como rodar localmente

### Requisitos

- Node.js 22+.

### Primeiros passos

```sh
npm run dev         # serve dist (catálogo gerado de data/apps)
```

Após rodar, abra:

- `http://127.0.0.1:4173/`

### Comandos de desenvolvimento

- `npm test`: validação de parsers, seed e remoção.
- `npm run check`: valida sintaxe JS e scripts.
- `npm run build:demo`: build com fixtures de teste.
- `npm run build`: build oficial com `data/apps`.
- `npm run seed:issues`: cria/associa issues reais no GitHub para apps existentes (sem `issueURL`) e atualiza `data/apps`.
  - Use `GITHUB_TOKEN` com escopo `issues: write`.
- `npm run labels:setup`: cria/atualiza labels de workflow.
- `npm run likes:changed`: consulta reações do GitHub e detecta se os likes mudaram em relação ao `dist/data/apps.json`.

## Observações de arquitetura de produção

- Cada app tem URL fixa:
  - `/apps/{slug}/`
  - `/author/{username}/`
- Reação no botão de “👍” é feita na Issue pública de origem.
- O valor de curtidas é snapshotado por release, não em tempo real.
- Não existe remoção automática por denúncia; sempre há trilha de revisão.

## Troubleshooting

- Página estática sem apps: rode `npm run build` e confira `data/apps` existe com registros válidos.
- Falha no build: execute `npm test` e `npm run check` para localizar schema inválido.
- Página de detalhe quebrada: confirme se o app possui `submission.issue` válido e se a build foi feita em cima de `data/apps` atual.
- Problemas com reações: a etapa de publicação busca reações pela API do GitHub; se a API falhar, fallback é manter último valor conhecido.

## Licença e limites editoriais

Os direitos sobre aplicativos, marcas e ativos pertencem aos respectivos titulares.
O projeto é independente e sem vínculo com a rede de origem do podcast.

## Status

Projeto ativo, com automação de seed, submissão, moderação, build e publicação em produção para a galeria de apps do segmento.
