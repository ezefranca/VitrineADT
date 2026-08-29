# Arquitetura do VitrineADT

## O que existe no projeto

VitrineADT é uma galeria de aplicações do segmento **Amigos do Área de Transferência** com publicação em GitHub Pages.  
A arquitetura é orientada por arquivos: o catálogo é versionado em JSON no repositório, e não em banco de dados.

O fluxo de produção funciona assim:

- Issue no GitHub (submissão, aprovação, fila, publicação).
- Scripts de CI no repositório atualizam os arquivos do catálogo.
- Build gera um site estático em `dist/`.
- GitHub Pages serve o estado da última release.

## Componentes

### 1) Dados

- `data/apps/*.json`: catálogo canônico (um app por arquivo).
- `data/bootstrap/adt-484-493.json`: manifest inicial, usado para bootstrap.
- `public/icons/*`: ícones baixados e versionados.
- `dist/data/apps.json`: dataset final do build.
- `tests/fixtures/apps/*`: dados de teste (não vão para produção).

### 2) Camada de automação (`scripts/`)

- `bootstrap-to-data.mjs`
  - Converte o manifest inicial para `data/apps`.
- `seed-catalog.mjs`
  - Workflow de bootstrap completo: verifica episódios, cria/atualiza issues e grava catálogo.
- `validate-submission.mjs`
  - Validação de issue de submissão (`submission/new`) contra formulário, episódio e evidências.
- `import-approved-app.mjs`
  - Importa apps aprovados (`moderation/approved`) com deduplicação por site/App Store/Google Play.
- `process-removal.mjs`
  - Remove app e ícone de catálogo sob pedido validado.
- `fetch-reactions.mjs`
  - Coleta reações 👍 por issue para alimentar os cards.
- `build-site.mjs`
  - Lê `data/apps`, agrega reações e gera o diretório `dist`.
- `catalog-pages.mjs`
  - Gera páginas estáticas:
  - `/apps/{slug}/` (detalhes do app)
  - `/author/{username}/` (agregador por conta do GitHub).
- `mark-queued.mjs`, `mark-published.mjs`, `mark-import-failed.mjs`
  - Sincronizam estado da publicação e comentários de retorno.
- `mark-*`, `setup-labels.mjs`, `github.mjs`, `images.mjs`
  - Atualização de labels, integração com GitHub API e download de ativos.

### 3) Camada de site (`site/`)

- `site/index.html`, `site/styles.css`, `site/app.js`
  - Renderização da homepage com:
  - filtros, busca, paginação e contagens por estado;
  - cards aleatorizados por carregamento (`Math.random()`).
- `site/share.js`, `site/site.js`, páginas institucionais (sobre/termos etc.).

## Esteira operacional no GitHub (end-to-end)

### A) Seed inicial (bootstrap)

1. Workflow manual `seed-catalog`.
2. `seed-catalog.mjs` valida manifest + episódios da API ADT.
3. Valida menção no segmento do episódio.
4. Cria/reusa issues com labels de seed.
5. Gera/atualiza `data/apps/*.json` e `public/icons`.
6. Executa testes e build antes do commit.

Observação: essa etapa organiza os dados reais no formato final. Em produção, não se usa o manifest bruto (`data/bootstrap/...`) diretamente no front.

### B) Submissão de novo app

1. Usuário abre Issue pelo template `.github/ISSUE_TEMPLATE/app.yml` com label `submission/new`.
2. Workflow `validate-submission` roda.
3. Script de validação:
   - parse do formulário;
   - consulta API de episódio;
   - checa notas e trecho de transcrição;
   - atualiza labels de estado.
4. Moderador marca `moderation/approved`.
5. Workflow `queue-approved-app` roda:
   - valida permissão do aprovador;
   - importa ou atualiza registro;
   - baixa ícone quando necessário;
   - commit no repositório;
   - aplica `publication/queued`.

Resultado: app entra na fila de publicação, sem ir ao site imediatamente.

### C) Publicação

1. Release publicada.
2. Workflow `publish-release`:
   - atualiza reações;
   - executa `build-site`;
   - publica artefatos no GitHub Pages;
   - marca issues como `publication/published`.

Resultado: site publicado reflete o snapshot daquela release.

### D) Remoção

1. Pedido via `.github/ISSUE_TEMPLATE/removal.yml` (`removal/new`).
2. `process-removal` identifica entry Issue alvo.
3. Se o solicitante for o titular, remove sem mediação; senão, aguarda aprovação.
4. Registra resultado na issue de pedido e mantém a issue original como registro histórico.
5. Remoção final entra em produção no próximo release.

### E) Reportes

- `report/new` abre fila de revisão manual.
- Não existe deleção automática por denúncia.

## Labels e estados

- `submission/new`
- `validation/passed`, `validation/needs-review`, `validation/failed`, `validation/source-unavailable`, `validation/recheck`
- `status/awaiting-moderation`
- `moderation/approved`, `moderation/rejected`
- `publication/queued`, `publication/published`
- `removal/new`, `removal/awaiting-moderation`, `removal/approved`, `removal/completed`, `removal/failed`
- `report/new`

`scripts/setup-labels.mjs` mantém esse conjunto alinhado.

## Estrutura de dados (`data/apps/*.json`)

Campos esperados:

- `schemaVersion: 1`
- `id` estável (ex.: `nome-do-app-49005`)
- `name`, `description`, `developer`, `platforms`, `links`
- `icon` (opcional): `path`, `sourceURL`, `sha256`
- `mentions[]`: episodio, data, URL, evidências
- `submission`: `issue`, `issueURL`, `submittedBy`, `approvedBy`, `approvedAt`
- `updatedAt`, `source`
- `likes` (atualizado durante release via reações)

Durante o build, esses registros viram o dataset final (`dist/data/apps.json`) já compatível com o frontend.

## Rotas públicas finais

- Home: `/`
- App: `/apps/{slug}/`
- Autor: `/author/{username}/`
- Páginas institucionais em `/sobre.html`, `/como-funciona.html`, `/termos.html`, etc.

## Segurança, consistência e qualidade

- Sem API dinâmica para leitura do catálogo.
- Todas as fontes externas entram com timeout/limite de tamanho e tratamento de erro.
- Validação em dois pontos:
  1) submissão (entrada humana + validação de estrutura e evidência);
  2) build (validação de schema por app).
- Reações não são em tempo real; são snapshot por release.

## O que é importante para operação

- O runtime publicado depende apenas de:
  - `dist/` gerado no repositório;
  - release ativa do GitHub Pages.
- Se mudar catálogo, precisa rodar release para refletir no site.
- Se falhar build/publicação, o estado anterior permanece disponível.

## Comandos úteis

- `npm test`
- `npm run check`
- `npm run build`
- `npm run build:demo`
- `npm run bootstrap:to-data`
- `npm run preview:real`
- `npm run dev`
- `npm run dev:data`
- `npm run labels:setup`
- `npm run seed:catalog`
- `npm run seed:verify`

