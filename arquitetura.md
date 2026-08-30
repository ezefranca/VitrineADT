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
- `public/icons/*`: ícones baixados e versionados.
- `dist/data/apps.json`: dataset final do build.
- `tests/fixtures/apps/*`: dados de teste (não vão para produção).

### 2) Camada de automação (`scripts/`)

- `validate-submission.mjs`
  - Validação de issue de submissão (`submission/new`) contra formulário, episódio e evidências.
- `import-approved-app.mjs`
  - Importa apps aprovados (`moderation/approved`) com deduplicação por site/App Store/Google Play.
- `process-removal.mjs`
  - Remove app e ícone de catálogo sob pedido validado.
- `metadata-update.mjs`
  - Interpreta pedidos de alteração de dados, verifica autoria ou aprovação de moderador e atualiza o registro canônico.
- `fetch-reactions.mjs`
  - Coleta reações 👍 por issue para alimentar os cards.
- `build-site.mjs`
  - Lê `data/apps`, agrega reações e gera o diretório `dist`.
- `catalog-pages.mjs`
  - Gera páginas estáticas:
  - `/apps/{slug}/` (detalhes do app)
  - `/author/{username}/` (agregador pelo perfil do desenvolvedor ou proprietário do repositório-fonte no GitHub).
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

### A) Submissão de novo app

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

### B) Atualização de metadados

1. O usuário abre `.github/ISSUE_TEMPLATE/metadata-update.yml` pelo link **Atualizar estas informações** da página do app.
2. O pedido identifica a entrada pela URL ou número da Issue original e aceita alterações de nome, desenvolvedor, descrição, plataformas, links e ícone. Campos em branco não alteram o valor existente.
3. Em uma Issue aberta, `process-metadata-update` compara o autor do pedido com `submission.submittedBy`:
   - mesma conta: aplica automaticamente;
   - conta diferente: adiciona `metadata/awaiting-moderation` e aguarda `metadata/approved`.
4. Ao receber `metadata/approved`, o workflow aceita somente um usuário com permissão de administração, manutenção, escrita ou triagem no repositório.
5. O script atualiza apenas os campos enviados, baixa e registra o hash do novo ícone quando necessário, preserva `mentions[]` e a referência da Issue original, e adiciona `metadata/applied`.
6. O commit gerado na `main` aciona a publicação do site.

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
- `metadata/update`, `metadata/awaiting-moderation`, `metadata/approved`, `metadata/applied`, `metadata/failed`
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
- Desenvolvedor ou autor do repositório-fonte: `/author/{username}/`
- Páginas institucionais em `/sobre.html`, `/como-funciona.html`, `/termos.html`, etc.

## Integrações externas

O site estático não faz consultas externas durante a navegação. A API pública do Gigahertz é usada em `scripts/submission.mjs` para validar uma submissão:

- `https://gigahertz.fm/api/podcasts/adt/{episódio}.json` fornece número, título, data, permalink e notas do episódio.
- `https://gigahertz.fm/podcasts/adt/{episódio}.txt` fornece a transcrição usada para confirmar a menção no segmento “Amigos do Área de Transferência”.

Após a validação, esses dados são persistidos em `data/apps/*.json` dentro de `mentions[]`. A API do GitHub, encapsulada em `scripts/github.mjs`, cuida das Issues, reações e automações de publicação.

## Segurança, consistência e qualidade

- Sem API dinâmica para leitura do catálogo.
- Todas as fontes externas entram com timeout/limite de tamanho e tratamento de erro.
- Validação em dois pontos:
  1) submissão (entrada humana + validação de estrutura e evidência);
  2) build (validação de schema por app).
- Reações não são em tempo real; são snapshot por release.

## O que é importante para operação

- O runtime publicado depende do `dist/` gerado pelo workflow e do último deploy ativo no GitHub Pages.
- Se mudar o catálogo na `main`, o workflow publica automaticamente; uma release também pode disparar a publicação.
- Se falhar build/publicação, o estado anterior permanece disponível.

## Comandos úteis

- `npm test`
- `npm run check`
- `npm run build`
- `npm run build:demo`
- `npm run dev`
- `npm run labels:setup`
