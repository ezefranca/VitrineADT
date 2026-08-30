<p align="center">
  <img src="site/icon.svg" alt="Ícone da VitrineADT" width="96">
</p>

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
- [API pública do catálogo](#api-pública-do-catálogo)
- [Rotas públicas](#rotas-públicas)
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
  - páginas por app (`/app/{slug}/`);
  - páginas por desenvolvedor ou proprietário do repositório-fonte (`/author/{username}/`);
  - páginas por episódio com todos os apps apresentados (`/episodes/{episode}/`);
  - `sitemap.xml`, `robots.txt` e dados estruturados JSON-LD para ajudar buscadores a relacionar apps, autores e episódios;
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

### 2.1) Atualização de metadados

1. Na página de um aplicativo, use **Atualizar estas informações** ou abra uma Issue com o template `metadata-update.yml`.
2. Informe a Issue da entrada e somente os campos que precisam mudar: nome, desenvolvedor, descrição, plataformas, links ou ícone. Campos deixados em branco preservam os valores atuais.
3. Se a Issue foi criada pela mesma conta registrada em `submission.submittedBy`, `process-metadata-update` aplica a alteração automaticamente.
4. Se veio de outra conta, a Issue recebe `metadata/awaiting-moderation`. Um moderador deve adicionar `metadata/approved` depois de conferir a solicitação.
5. O workflow valida a permissão do moderador, baixa um novo ícone quando solicitado, atualiza `data/apps/*.json` e preserva `mentions[]` e a Issue original.
6. A alteração aplicada recebe `metadata/applied`; a próxima publicação mostra os novos metadados.

### 3) Publicação

1. Uma release é criada no GitHub.
2. Workflow `publish-release` (executado em push na `main`, por release publicada ou manualmente):
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
- Metadados: `metadata/update`, `metadata/awaiting-moderation`, `metadata/approved`, `metadata/applied`, `metadata/failed`
- Publicação: `publication/queued`, `publication/published`
- Remoção: `removal/new`, `removal/awaiting-moderation`, `removal/approved`, `removal/completed`, `removal/failed`

### Publicação manual

1. Um push na `main` publica automaticamente o catálogo atualizado. Também é possível criar uma release ou executar `publish-release` manualmente.
2. Aguarde `publish-release` concluir.
3. A URL publicada ficará disponível no ambiente do GitHub Pages.

O deploy acontece automaticamente após um push na `main` ou uma release publicada.

### SEO e descoberta

O build gera uma URL canônica, metadados Open Graph/Twitter e JSON-LD para cada página pública. Apps usam `SoftwareApplication`, episódios usam `PodcastEpisode` e autores usam `Person`, sempre com links internos entre o projeto, seu criador e o episódio correspondente.

`dist/sitemap.xml` lista a home, páginas institucionais, apps, autores e episódios. `dist/robots.txt` permite o rastreamento e aponta para o sitemap. O sitemap deve ser cadastrado no Google Search Console para acelerar a descoberta das URLs, sem garantia de indexação.

## API pública do catálogo

O catálogo funciona como uma API simples baseada em arquivos. Cada app aprovado é um JSON independente em `data/apps/`; não há banco de dados nem endpoint próprio para leitura. O GitHub é a camada pública de distribuição desses arquivos.

### Listar os apps

Use a API de Contents do GitHub para obter a lista dos arquivos e seus `download_url`:

```sh
curl -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/ezefranca/VitrineADT/contents/data/apps?ref=main"
```

No JavaScript:

```js
const response = await fetch("https://api.github.com/repos/ezefranca/VitrineADT/contents/data/apps?ref=main", {
  headers: { Accept: "application/vnd.github+json" }
});
const files = await response.json();
const apps = await Promise.all(files
  .filter((file) => file.name.endsWith(".json"))
  .map((file) => fetch(file.download_url).then((item) => item.json())));
```

### Obter um app

Para um arquivo conhecido, prefira o JSON raw, que já retorna o registro pronto:

```text
https://raw.githubusercontent.com/ezefranca/VitrineADT/main/data/apps/{arquivo}.json
```

Também é possível usar a Contents API para obter o mesmo arquivo. A resposta inclui o campo `content` em Base64 e o `download_url`:

```text
https://api.github.com/repos/ezefranca/VitrineADT/contents/data/apps/{arquivo}.json?ref=main
```

O snapshot já agregado para a interface está disponível em [`/data/apps.json`](https://vitrineadt.ezequiel.app/data/apps.json). Ele inclui `apps`, `repositoryURL` e `generatedAt`, além de campos derivados como `slug`, `detailPath`, `author` e `likes`; para integrações estáveis, use os JSONs individuais como fonte canônica.

### Formato de um registro

```json
{
  "schemaVersion": 1,
  "id": "nome-do-app-49301",
  "name": "Nome do app",
  "description": "Descrição curta",
  "developer": { "name": "Nome do criador", "url": "https://github.com/usuario" },
  "platforms": ["ios"],
  "links": { "website": "https://exemplo.com", "appStore": "", "googlePlay": "", "source": "" },
  "icon": { "path": "/icons/nome-do-app-49301.png", "sourceURL": "https://exemplo.com/icon.png" },
  "mentions": [{ "episode": 493, "title": "493: Título", "date": "2026-08-28", "url": "https://gigahertz.fm/podcasts/adt/493" }],
  "submission": { "issue": 49301, "issueURL": "https://github.com/ezefranca/VitrineADT/issues/49301" },
  "updatedAt": "2026-08-29T14:35:36.145Z"
}
```

`mentions[]` é uma lista porque o mesmo app pode aparecer em vários episódios. A posição do app em “Últimas menções” considera o maior número de episódio, e não a ordem do arquivo ou a data de inclusão.

## Rotas públicas

- `/` — catálogo inicial e busca de aplicativos.
- `/app/{slug}/` — detalhe de um aplicativo. Esta é a rota canônica singular.
- `/apps/{slug}/` — redirect de compatibilidade para `/app/{slug}/`.
- `/author/{username}/` — aplicativos associados a um desenvolvedor ou proprietário de repositório público.
- `/episodes/{episode}/` — todos os aplicativos apresentados em um episódio.
- `/data/apps.json` — snapshot agregado consumido pela home.
- `/sitemap.xml` — mapa de URLs públicas para rastreadores.
- `/robots.txt` — regras de rastreamento e endereço do sitemap.
- `/sobre.html`, `/como-funciona.html`, `/termos.html`, `/privacidade.html` e `/codigo-de-conduta.html` — páginas institucionais.

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
  - `/app/{slug}/`
  - `/apps/{slug}/` (redirect legado)
  - `/author/{username}/`
  - `/episodes/{episode}/`
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
